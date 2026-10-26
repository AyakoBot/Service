import { RequestHandlerError } from '@ayako/api';
import { TicketState, type TicketSetting } from '@ayako/database';

import getUser from '../../../Util/getUser.js';
import type ChannelTicket from '../Classes/ChannelTicket.js';
import { BaseTicketErrors } from '../Classes/Enums.js';
import type TicketPlugin from '../Plugin.js';

import { isForceBlocked } from './forceBlock.js';
import { forcedTicket } from './forcedTicket.js';
import getForceOpenableKinds, { ForceOpenBlock, blockReason } from './getForceOpenableKinds.js';
import { getErrorMessage } from './handleTicketError.js';
import { systemDisplayLabel } from './systemLabel.js';
import {
 TagCommand,
 TagIssue,
 TagStage,
 assignInput,
 idOf,
 issueText,
 parseTagCommands,
 planContact,
 priorityOf,
 tagIssue,
 type ContactPlan,
 type TagStep,
} from './tagCommands.js';

type Translator = Awaited<ReturnType<TicketPlugin['t']>>;
type TagStepRun = (this: ChannelTicket, actorId: string, value: string) => Promise<unknown>;

interface PresenceCheck {
 missing: (this: TicketPlugin, guildId: string, value: string) => Promise<boolean>;
 text: (t: Translator, entry: string) => string;
}

const steps: Record<Exclude<TagCommand, TagCommand.Contact>, TagStepRun> = {
 [TagCommand.Move]: function (_actorId, value) {
  return this.move(idOf(value) ?? '');
 },
 [TagCommand.Claim]: async function (actorId) {
  const ticket = await this.getTicket();
  if (ticket.state === TicketState.claimed && ticket.claimer === actorId) return;

  await this.claim({ userId: actorId }).next();
 },
 [TagCommand.Unclaim]: function (actorId) {
  return this.unclaim({ userId: actorId }).next();
 },
 [TagCommand.Take]: function (actorId) {
  return this.take({ userId: actorId }).next();
 },
 [TagCommand.Close]: async function (actorId, value) {
  await this.close({ userId: actorId, reason: value || undefined }).next();
  await this.deleteAfterClose(actorId);
 },
 [TagCommand.Delete]: async function (actorId) {
  if ((await this.getTicket()).state === TicketState.deleted) return;
  await this.delete({ userId: actorId }).next();
 },
 [TagCommand.Priority]: async function (actorId, value) {
  const level = priorityOf(value);
  if (!level) return;

  await this.setPriority(actorId, level);
  await this.refreshSurface();
 },
 [TagCommand.Escalate]: async function (actorId, value) {
  await this.getTicket();
  const tier = (await this.listTiers()).find(
   (candidate) => candidate.name.toLowerCase() === value.toLowerCase(),
  );
  if (!tier) throw new Error(BaseTicketErrors.escalate_TierNotFound);

  await this.escalate({ userId: actorId, targetTierId: String(tier.id) }).next();
 },
 [TagCommand.Add]: function (actorId, value) {
  return this.addMember(actorId, idOf(value) ?? '');
 },
 [TagCommand.Remove]: function (actorId, value) {
  return this.removeMember(actorId, idOf(value) ?? '');
 },
};

const presenceChecks: Partial<Record<TagCommand, PresenceCheck>> = {
 [TagCommand.Move]: {
  missing: async function (guildId, value) {
   const channel = await this.client.cache.channels.get(idOf(value) ?? '');
   return channel?.guild_id !== guildId;
  },
  text: (t, entry) => t.tag.commands.channelMissing({ entry }),
 },
 [TagCommand.Escalate]: {
  missing: async function (guildId, value) {
   const tier = await this.client.db.client.ticketTier.findFirst({
    where: { name: { equals: value, mode: 'insensitive' }, settings: { guild: guildId } },
   });
   return !tier;
  },
  text: (t, entry) => t.tag.commands.tierMissing({ entry }),
 },
};

const runStep = async function (
 this: ChannelTicket,
 t: Translator,
 actorId: string,
 step: TagStep,
): Promise<string | null> {
 const issue = tagIssue(step, TagStage.Run);
 if (!step.command || step.command === TagCommand.Contact || issue) {
  return issueText(t, step, issue ?? TagIssue.Unknown, TagStage.Run);
 }

 const failure = await steps[step.command].call(this, actorId, step.value).then(
  () => null,
  (error: Error) => error,
 );
 if (!failure) return null;

 return t.tag.commands.failed({
  entry: step.entry,
  error: getErrorMessage.call(this.client, t, failure),
 });
};

export const runTagCommands = async function (
 this: ChannelTicket,
 actorId: string,
 tagSteps: TagStep[],
 input: string,
): Promise<string[]> {
 const parsed = assignInput(tagSteps, input);
 if (!parsed.length) return [];

 const t = await this.plugin.t((await this.getTicket()).settings.guild);
 if (!(await this.isUserStaff(actorId).catch(() => false))) return [t.tag.commands.notStaff()];

 const warnings: string[] = [];
 for (const step of parsed) {
  const warning = await runStep.call(this, t, actorId, step);
  if (warning) warnings.push(warning);
 }

 return warnings;
};

const contactProblem = async function (
 this: TicketPlugin,
 t: Translator,
 guildId: string,
 step: TagStep,
 issue: TagIssue | null,
): Promise<string | null> {
 const candidates = await getForceOpenableKinds.call(this, guildId, '', []);
 const usable = candidates.filter(
  (entry) => !entry.block || entry.block === ForceOpenBlock.NotStaff,
 );
 const match = issue
  ? undefined
  : candidates.find((entry) => String(entry.settings.id) === step.value);

 if (match && usable.includes(match)) return null;
 if (match?.block) {
  return t.tag.commands.systemBlocked({
   entry: step.entry,
   system: systemDisplayLabel(t, match.settings),
   reason: blockReason(t, match.block),
  });
 }
 if (!usable.length) return t.tag.commands.noUsableSystems({ entry: step.entry });
 if (!issue && !step.value) return null;

 const systems = usable
  .map((entry) => `${systemDisplayLabel(t, entry.settings)} (\`${String(entry.settings.id)}\`)`)
  .join(', ');

 return t.tag.commands.systemsList({ entry: step.entry, systems });
};

const saveProblem = async function (
 this: TicketPlugin,
 t: Translator,
 guildId: string,
 step: TagStep,
): Promise<string | null> {
 const issue = tagIssue(step, TagStage.Save);
 if (step.command === TagCommand.Contact) return contactProblem.call(this, t, guildId, step, issue);
 if (!step.command || issue) {
  return issueText(t, step, issue ?? TagIssue.Unknown, TagStage.Save);
 }

 const check = presenceChecks[step.command];
 if (!check || !(await check.missing.call(this, guildId, step.value))) return null;

 return check.text(t, step.entry);
};

export const tagCommandProblems = async function (
 this: TicketPlugin,
 guildId: string,
 commands: string | null,
): Promise<string[]> {
 const t = await this.t(guildId);
 const entries = parseTagCommands(commands);
 const extras = planContact(entries, '')?.extras ?? [];
 const problems = await Promise.all(
  entries.map((step) =>
   extras.includes(step)
    ? issueText(t, step, TagIssue.ExtraContact, TagStage.Save)
    : saveProblem.call(this, t, guildId, step),
  ),
 );

 return problems.filter((problem): problem is string => problem !== null);
};

const liveStates = [TicketState.opened, TicketState.claimed];

const rolesOf = async function (this: TicketPlugin, guildId: string, userId: string) {
 const cached = await this.client.cache.members.get(guildId, userId);
 if (cached) return cached.roles;

 const api = await this.getAPI(guildId);
 const fetched = await api.guilds.getMember(guildId, userId, {
  origin: this.name,
  reason: 'Checking a snippet contact',
  silent: true,
 });

 return fetched && !(fetched instanceof RequestHandlerError) ? fetched.roles : null;
};

export interface ContactResult {
 ticket: ChannelTicket | null;
 choices: TicketSetting[] | null;
 warnings: string[];
}

export const openContact = async function (
 this: TicketPlugin,
 guildId: string,
 staffId: string,
 plan: ContactPlan,
 systemId?: string,
): Promise<ContactResult> {
 const t = await this.t(guildId);
 const extras = plan.extras.map((step) => issueText(t, step, TagIssue.ExtraContact, TagStage.Run));
 const skip = (issue: TagIssue): ContactResult => ({
  ticket: null,
  choices: null,
  warnings: [...extras, issueText(t, plan.step, issue, TagStage.Run)],
 });
 const fail = (error: string): ContactResult => ({
  ticket: null,
  choices: null,
  warnings: [...extras, t.tag.commands.failed({ entry: plan.step.entry, error })],
 });

 const issue = tagIssue(plan.step, TagStage.Run);
 if (issue) return skip(issue);

 const targetId = idOf(plan.user);
 if (!targetId) return skip(TagIssue.NeedsUser);

 const targetRoles = await rolesOf.call(this, guildId, targetId);
 const fetched = await getUser.call(this.client, targetId);
 const target = fetched && !(fetched instanceof RequestHandlerError) ? fetched : null;
 if (!targetRoles || !target || target.bot || targetId === staffId) {
  return fail(t.forceOpen.targetInvalid());
 }
 if (await isForceBlocked.call(this.client, guildId, targetId)) {
  return fail(t.forceOpen.blockedNote());
 }

 const staffRoles = (await rolesOf.call(this, guildId, staffId)) ?? [];
 const candidates = await getForceOpenableKinds.call(this, guildId, staffId, staffRoles);
 const usable = candidates.filter((entry) => !entry.block).map((entry) => entry.settings);
 const wanted = systemId ?? plan.step.value;

 if (!wanted && usable.length > 1) return { ticket: null, choices: usable, warnings: extras };
 if (!wanted && !usable.length) return fail(t.tag.commands.noOwnSystems());

 const candidate = candidates.find((entry) =>
  wanted ? String(entry.settings.id) === wanted : entry.settings === usable[0],
 );
 if (!candidate) return fail(t.tag.commands.systemUnknown());
 if (candidate.block) return fail(blockReason(t, candidate.block));

 const { ticket, create } = forcedTicket.call(this, {
  settings: candidate.settings,
  targetId,
  staffId,
  roleIds: targetRoles,
  username: target.username || targetId,
 });

 const failure = await create.next().then(
  () => null,
  (error: Error) => error,
 );
 if (failure) return fail(getErrorMessage.call(this.client, t, failure));

 const row = await ticket.getTicket().catch(() => null);
 if (!row || !liveStates.includes(row.state)) return fail(t.forceOpen.dmClosedNote());

 return { ticket, choices: null, warnings: extras };
};
