import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import base from '../../../Languages/en-GB.json' with { type: 'json' };
import createTranslator from '../../../Util/translator.js';
import en from '../Language/en-GB.json' with { type: 'json' };
import type TicketPlugin from '../Plugin.js';

import {
 NameVar,
 convertTemplate,
 nameHelpText,
 renderName,
 sameName,
 usedNameVars,
} from './ticketName.js';

const t = {
 ...createTranslator(en),
 base: createTranslator(base),
} as unknown as Awaited<ReturnType<TicketPlugin['t']>>;

describe('renderName', () => {
 it("keeps today's names when no format is set", () => {
  assert.equal(
   renderName(null, { state: 'Opened', user: 'max', userid: '123' }),
   '[Opened] max 123',
  );
  assert.equal(renderName('  ', { state: 'Opened', user: '', userid: '123' }), '[Opened] 123');
 });

 it('fills the variables', () => {
  assert.equal(
   renderName('[{{state}}] {{user}} - {{staff}}', {
    state: 'Claimed',
    user: 'max',
    staff: 'frank',
   }),
   '[Claimed] max - frank',
  );
 });

 it('leaves unknown placeholders as typed', () => {
  assert.equal(renderName('{{nope}} {{user}}', { user: 'max' }), '{{nope}} max');
 });

 it('cuts the name to 100 characters', () => {
  assert.equal(renderName('x'.repeat(150), {}).length, 100);
 });

 it('falls back to the default when the format renders empty', () => {
  assert.equal(renderName('{{user}}', { user: '', state: 'Opened', userid: '1' }), '[Opened] 1');
 });
});

describe('convertTemplate', () => {
 it('swaps spaces and dashes when the system type changes', () => {
  assert.equal(
   convertTemplate('[{{state}}] {{user}} - {{staff}}', true),
   '[{{state}}]-{{user}}---{{staff}}',
  );
  assert.equal(convertTemplate('[{{state}}]-{{user}}', false), '[{{state}}] {{user}}');
 });
});

describe('sameName', () => {
 it('treats a Discord channel name as equal to its format', () => {
  assert.equal(sameName('[opened]-max-123', '[Opened] max 123'), true);
  assert.equal(sameName('[opened]-max-123', '[Claimed] max 123'), false);
 });
});

describe('usedNameVars', () => {
 it('finds only the variables a format uses', () => {
  assert.deepEqual(usedNameVars('{{staff}} {{user}} {{nope}}'), [NameVar.User, NameVar.Staff]);
 });
});

describe('nameHelpText', () => {
 it('lists every variable', () => {
  const lines = nameHelpText(t).split('\n');
  for (const key of Object.values(NameVar)) {
   assert.ok(
    lines.some((line) => line.startsWith(`- \`{{${key}}}\``)),
    key,
   );
  }
 });
});
