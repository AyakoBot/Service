/* eslint-disable @typescript-eslint/naming-convention */
import { TicketPriority } from '@ayako/database';
import { ChannelType, type RESTPatchAPIGuildChannelPositionsJSONBody } from 'discord-api-types/v10';

import type TicketPlugin from '../Plugin.js';

type Translator = Awaited<ReturnType<TicketPlugin['t']>>;

export const triggerMaxLength = 32;

export enum TagCommand {
 Contact = 'contact',
 Move = 'move',
 Claim = 'claim',
 Unclaim = 'unclaim',
 Take = 'take',
 Close = 'close',
 Delete = 'delete',
 Priority = 'priority',
 Escalate = 'escalate',
 Add = 'add',
 Remove = 'remove',
}

export enum TagIssue {
 Unknown = 'unknown',
 NeedsChannel = 'needsChannel',
 NeedsLevel = 'needsLevel',
 NeedsTier = 'needsTier',
 NoValue = 'noValue',
 NeedsUser = 'needsUser',
 NeedsSystem = 'needsSystem',
 ExtraContact = 'extraContact',
}

export enum TagStage {
 Save = 'save',
 Run = 'run',
}

export interface TagStep {
 entry: string;
 command: TagCommand | null;
 value: string;
}

export interface Placeable {
 id: string;
 type: ChannelType;
 position?: number;
 parent_id?: string | null;
}

const commands = Object.values(TagCommand);
const userCommands = [TagCommand.Add, TagCommand.Remove];
const voiceTypes = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];

export const idOf = (value: string): string | null => {
 const match = /^<[@#]!?(\d{17,20})>$|^(\d{17,20})$/.exec(value.trim());
 return match?.[1] ?? match?.[2] ?? null;
};

export const priorityOf = (value: string): TicketPriority | null =>
 Object.values(TicketPriority).find(
  (level) => level.toLowerCase() === value.trim().toLowerCase(),
 ) ?? null;

const noValue = (value: string) => (value ? TagIssue.NoValue : null);

const userValue = (value: string, stage: TagStage) => {
 if (!value) return stage === TagStage.Run ? TagIssue.NeedsUser : null;
 return idOf(value) ? null : TagIssue.NeedsUser;
};

const checks: Record<TagCommand, (value: string, stage: TagStage) => TagIssue | null> = {
 [TagCommand.Contact]: (value) =>
  !value || /^\d{1,20}$/.test(value) ? null : TagIssue.NeedsSystem,
 [TagCommand.Move]: (value) => (idOf(value) ? null : TagIssue.NeedsChannel),
 [TagCommand.Claim]: noValue,
 [TagCommand.Unclaim]: noValue,
 [TagCommand.Take]: noValue,
 [TagCommand.Close]: () => null,
 [TagCommand.Delete]: noValue,
 [TagCommand.Priority]: (value) => (priorityOf(value) ? null : TagIssue.NeedsLevel),
 [TagCommand.Escalate]: (value) => (value ? null : TagIssue.NeedsTier),
 [TagCommand.Add]: userValue,
 [TagCommand.Remove]: userValue,
};

export const parseTagCommands = (text: string | null): TagStep[] =>
 (text ?? '')
  .split(/[,\n]/)
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
   const [word = ''] = entry.split(/\s/, 1);
   return {
    entry,
    command: commands.find((command) => command === word.toLowerCase()) ?? null,
    value: entry.slice(word.length).trim(),
   };
  });

export const tagIssue = (step: TagStep, stage: TagStage): TagIssue | null =>
 step.command ? checks[step.command](step.value, stage) : TagIssue.Unknown;

const takesUser = (step: TagStep) =>
 !step.value && step.command !== null && userCommands.includes(step.command);

export const assignInput = (steps: TagStep[], input: string): TagStep[] => {
 const words = input.trim().split(/\s+/).filter(Boolean);
 const users = words.slice(0, steps.filter(takesUser).length);
 const reason = words.slice(users.length).join(' ');

 return steps.map((step) => {
  if (takesUser(step)) return { ...step, value: users.shift() ?? '' };
  if (!step.value && step.command === TagCommand.Close) return { ...step, value: reason };
  return step;
 });
};

export interface ContactPlan {
 step: TagStep;
 user: string;
 extras: TagStep[];
 steps: TagStep[];
 input: string;
}

const isContact = (step: TagStep) => step.command === TagCommand.Contact;

export const planContact = (steps: TagStep[], input: string): ContactPlan | null => {
 const [step, ...extras] = steps.filter(isContact);
 if (!step) return null;

 const [user = '', ...rest] = input.trim().split(/\s+/).filter(Boolean);

 return {
  step,
  user,
  extras,
  steps: steps.filter((other) => !isContact(other)),
  input: rest.join(' '),
 };
};

export const triggerCandidates = (content: string): string[] => {
 const text = content.trim();
 const cuts = [...text.matchAll(/\s+/g)].map((match) => text.slice(0, match.index));

 return [...cuts, text].filter((candidate) => candidate.length <= triggerMaxLength);
};

const isVoice = (channel: Placeable) => voiceTypes.includes(channel.type);

const byPosition = (a: Placeable, b: Placeable) =>
 (a.position ?? 0) - (b.position ?? 0) || (BigInt(a.id) < BigInt(b.id) ? -1 : 1);

export const movePositions = (
 channels: Placeable[],
 channelId: string,
 target: Placeable,
): RESTPatchAPIGuildChannelPositionsJSONBody => {
 if (target.type === ChannelType.GuildCategory) {
  return [{ id: channelId, parent_id: target.id, lock_permissions: false }];
 }

 const parent = target.parent_id ?? null;
 const siblings = channels
  .filter(
   (channel) =>
    channel.id !== channelId &&
    channel.type !== ChannelType.GuildCategory &&
    (channel.parent_id ?? null) === parent &&
    isVoice(channel) === isVoice(target),
  )
  .sort(byPosition)
  .map((channel) => channel.id);
 const after = siblings.indexOf(target.id) + 1;

 return [...siblings.slice(0, after), channelId, ...siblings.slice(after)].map((id, position) =>
  id === channelId
   ? { id, position, parent_id: parent, lock_permissions: false }
   : { id, position },
 );
};

const reasons: Record<TagIssue, (t: Translator) => string> = {
 [TagIssue.Unknown]: (t) => t.tag.commands.unknown(),
 [TagIssue.NeedsChannel]: (t) => t.tag.commands.needsChannel(),
 [TagIssue.NeedsLevel]: (t) => t.tag.commands.needsLevel(),
 [TagIssue.NeedsTier]: (t) => t.tag.commands.needsTier(),
 [TagIssue.NoValue]: (t) => t.tag.commands.noValue(),
 [TagIssue.NeedsUser]: (t) => t.tag.commands.needsUser(),
 [TagIssue.NeedsSystem]: (t) => t.tag.commands.needsSystem(),
 [TagIssue.ExtraContact]: (t) => t.tag.commands.extraContact(),
};

const wrappers: Record<
 TagStage,
 (t: Translator, vars: { entry: string; reason: string }) => string
> = {
 [TagStage.Save]: (t, vars) => t.tag.commands.ignored(vars),
 [TagStage.Run]: (t, vars) => t.tag.commands.skipped(vars),
};

export const issueText = (t: Translator, step: TagStep, issue: TagIssue, stage: TagStage) =>
 wrappers[stage](t, { entry: step.entry, reason: reasons[issue](t) });

const commandHelp: Record<TagCommand, (t: Translator) => string> = {
 [TagCommand.Contact]: (t) => t.tag.help.contact(),
 [TagCommand.Move]: (t) => t.tag.help.move(),
 [TagCommand.Claim]: (t) => t.tag.help.claim(),
 [TagCommand.Unclaim]: (t) => t.tag.help.unclaim(),
 [TagCommand.Take]: (t) => t.tag.help.take(),
 [TagCommand.Close]: (t) => t.tag.help.close(),
 [TagCommand.Delete]: (t) => t.tag.help.delete(),
 [TagCommand.Priority]: (t) => t.tag.help.priority(),
 [TagCommand.Escalate]: (t) => t.tag.help.escalate(),
 [TagCommand.Add]: (t) => t.tag.help.add(),
 [TagCommand.Remove]: (t) => t.tag.help.remove(),
};

export const tagHelpText = (t: Translator, command: string) =>
 [
  `### ${t.tag.advancedTitle()}`,
  t.tag.help.intro(),
  `**${t.tag.help.commandsTitle()}**`,
  ...commands.map((tagCommand) => `- ${commandHelp[tagCommand](t)}`),
  `**${t.tag.help.inputTitle()}**`,
  t.tag.help.input({ command }),
  `**${t.tag.help.examplesTitle()}**`,
  t.tag.help.examples(),
 ].join('\n');
