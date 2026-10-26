import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ChannelType } from 'discord-api-types/v10';

import base from '../../../Languages/en-GB.json' with { type: 'json' };
import createTranslator from '../../../Util/translator.js';
import en from '../Language/en-GB.json' with { type: 'json' };
import type TicketPlugin from '../Plugin.js';

import {
 TagCommand,
 TagIssue,
 TagStage,
 assignInput,
 issueText,
 movePositions,
 parseTagCommands,
 planContact,
 tagHelpText,
 tagIssue,
 triggerCandidates,
} from './tagCommands.js';

const t = {
 ...createTranslator(en),
 base: createTranslator(base),
} as unknown as Awaited<ReturnType<TicketPlugin['t']>>;

const user = '123456789012345678';
const issues = (text: string, stage = TagStage.Save) =>
 parseTagCommands(text).map((step) => tagIssue(step, stage));

describe('parseTagCommands', () => {
 it('keeps every entry in order, typos included', () => {
  const steps = parseTagCommands('claim, clsoe,\nDelete');
  assert.deepEqual(
   steps.map((step) => step.command),
   [TagCommand.Claim, null, TagCommand.Delete],
  );
  assert.deepEqual(issues('claim, clsoe, delete'), [null, TagIssue.Unknown, null]);
 });

 it('splits the keyword from its value', () => {
  const [close] = parseTagCommands('close  no reply for 3 days');
  assert.equal(close?.command, TagCommand.Close);
  assert.equal(close?.value, 'no reply for 3 days');
 });

 it('flags values on keywords that take none', () => {
  assert.deepEqual(issues('claim now, take, delete it'), [
   TagIssue.NoValue,
   null,
   TagIssue.NoValue,
  ]);
 });

 it('checks fixed values', () => {
  assert.deepEqual(issues(`move, move <#${user}>, priority, priority uRgEnT, priority mild`), [
   TagIssue.NeedsChannel,
   null,
   TagIssue.NeedsLevel,
   null,
   TagIssue.NeedsLevel,
  ]);
  assert.deepEqual(issues('escalate, escalate Tier 2'), [TagIssue.NeedsTier, null]);
 });

 it('lets add and remove wait for input when saving, and requires it when running', () => {
  assert.deepEqual(issues('add, remove bob'), [null, TagIssue.NeedsUser]);
  assert.deepEqual(issues('add', TagStage.Run), [TagIssue.NeedsUser]);
  assert.deepEqual(issues(`add <@!${user}>`, TagStage.Run), [null]);
 });
});

describe('assignInput', () => {
 const run = (commands: string, input: string) =>
  assignInput(parseTagCommands(commands), input).map((step) => step.value);

 it('gives users to add and remove in order and the rest to close', () => {
  assert.deepEqual(run('add, remove, close', `${user} 2 away for now`), [
   user,
   '2',
   'away for now',
  ]);
 });

 it('never overrides fixed values', () => {
  assert.deepEqual(run('close inactivity', 'away'), ['inactivity']);
  assert.deepEqual(run(`add ${user}, close`, 'away'), [user, 'away']);
 });

 it('leaves steps empty when there is no input', () => {
  assert.deepEqual(run('add, close', ''), ['', '']);
 });
});

describe('triggerCandidates', () => {
 it('cuts only at whitespace, longest last', () => {
  assert.deepEqual(triggerCandidates('  ?inactive  away now '), [
   '?inactive',
   '?inactive  away',
   '?inactive  away now',
  ]);
 });

 it('drops candidates longer than a trigger can be', () => {
  assert.deepEqual(triggerCandidates(`?in ${'x'.repeat(40)}`), ['?in']);
 });
});

describe('movePositions', () => {
 const ticket = '900000000000000000';
 const channels = [
  { id: '100000000000000001', type: ChannelType.GuildCategory, position: 0 },
  {
   id: '100000000000000002',
   type: ChannelType.GuildText,
   position: 0,
   parent_id: '100000000000000001',
  },
  {
   id: '100000000000000003',
   type: ChannelType.GuildText,
   position: 1,
   parent_id: '100000000000000001',
  },
  {
   id: '100000000000000004',
   type: ChannelType.GuildVoice,
   position: 0,
   parent_id: '100000000000000001',
  },
  { id: ticket, type: ChannelType.GuildText, position: 5, parent_id: null },
 ];

 it('moves into a category without syncing permissions', () => {
  assert.deepEqual(movePositions(channels, ticket, channels[0]!), [
   { id: ticket, parent_id: '100000000000000001', lock_permissions: false },
  ]);
 });

 it("places the ticket directly below a channel in that channel's category", () => {
  assert.deepEqual(movePositions(channels, ticket, channels[1]!), [
   { id: '100000000000000002', position: 0 },
   { id: ticket, position: 1, parent_id: '100000000000000001', lock_permissions: false },
   { id: '100000000000000003', position: 2 },
  ]);
 });
});

describe('issueText', () => {
 it('words a save-time warning the way staff expect', () => {
  const [step] = parseTagCommands('clsoe');
  assert.equal(
   issueText(t, step!, TagIssue.Unknown, TagStage.Save),
   '`clsoe` is not a valid command, it will be ignored.',
  );
 });
});

describe('tagHelpText', () => {
 it('gives every command its own line', () => {
  const lines = tagHelpText(t, '/tag').split('\n');
  for (const command of Object.values(TagCommand)) {
   assert.ok(
    lines.some((line) => line.startsWith(`- \`${command}`)),
    command,
   );
  }
 });
});

describe('planContact', () => {
 it('gives contact the first word and the rest to the other steps', () => {
  const plan = planContact(
   parseTagCommands('add, contact 1712345678901, close'),
   `${user} 2 see you`,
  );
  assert.equal(plan?.step.value, '1712345678901');
  assert.equal(plan?.user, user);
  assert.deepEqual(
   assignInput(plan!.steps, plan!.input).map((step) => step.value),
   ['2', 'see you'],
  );
 });

 it('keeps only the first contact', () => {
  const plan = planContact(parseTagCommands('contact 1, contact 2'), user);
  assert.equal(plan?.step.value, '1');
  assert.deepEqual(
   plan?.extras.map((step) => step.entry),
   ['contact 2'],
  );
 });

 it('accepts no system id or a numeric one', () => {
  assert.deepEqual(issues('contact, contact support, contact 1712345678901'), [
   null,
   TagIssue.NeedsSystem,
   null,
  ]);
 });

 it('returns nothing without contact', () => {
  assert.equal(planContact(parseTagCommands('claim'), user), null);
 });
});
