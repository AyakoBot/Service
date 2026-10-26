import type { Giveaway } from '@ayako/database';
import type { APIPartialEmoji } from 'discord-api-types/v10';

import constants from '../../../Classes/Constants.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { formatDurationSeconds } from '../../../Util/durationSeconds.js';
import { snowflakeToMs } from '../../../Util/snowflakeToMs.js';
import type GiveawaysPlugin from '../Plugin.js';

type Translator = Awaited<ReturnType<GiveawaysPlugin['t']>>;

export enum GiveawayRequirement {
 Excluded = 'excluded',
 Role = 'role',
 AccountAge = 'accountAge',
 Tenure = 'tenure',
 Messages = 'messages',
 MessagesSince = 'messagesSince',
 VoiceTime = 'voiceTime',
}

export interface RequirementSubject {
 userId: string;
 roles: string[];
 joinedAt: string | null;
 messages: number;
 messagesSince: number;
 voiceSeconds: number;
}

export const requirementOrder = [
 GiveawayRequirement.Excluded,
 GiveawayRequirement.Role,
 GiveawayRequirement.AccountAge,
 GiveawayRequirement.Tenure,
 GiveawayRequirement.Messages,
 GiveawayRequirement.MessagesSince,
 GiveawayRequirement.VoiceTime,
];

type Predicate = (giveaway: Giveaway, subject: RequirementSubject) => boolean;

const atLeast = (column: unknown, actual: number) =>
 column === null || column === undefined || actual >= Number(column);

const holdsAny = (roles: string[], wanted: string[]) => wanted.some((role) => roles.includes(role));

const predicates: Record<GiveawayRequirement, Predicate> = {
 [GiveawayRequirement.Excluded]: (giveaway, subject) =>
  !holdsAny(subject.roles, giveaway.excludedRoles),
 [GiveawayRequirement.Role]: (giveaway, subject) =>
  !giveaway.requiredRoles.length || holdsAny(subject.roles, giveaway.requiredRoles),
 [GiveawayRequirement.AccountAge]: (giveaway, subject) => {
  if (giveaway.minAccountSeconds === null) return true;

  const created = snowflakeToMs(subject.userId);
  if (created === null) return false;

  return atLeast(giveaway.minAccountSeconds, (Date.now() - created) / 1000);
 },
 [GiveawayRequirement.Tenure]: (giveaway, subject) => {
  if (giveaway.minTenureSeconds === null) return true;
  if (!subject.joinedAt) return false;

  const joined = new Date(subject.joinedAt).getTime();
  if (!Number.isFinite(joined)) return false;

  return atLeast(giveaway.minTenureSeconds, (Date.now() - joined) / 1000);
 },
 [GiveawayRequirement.Messages]: (giveaway, subject) =>
  atLeast(giveaway.minMessages, subject.messages),
 [GiveawayRequirement.MessagesSince]: (giveaway, subject) =>
  atLeast(giveaway.minMessagesSince, subject.messagesSince),
 [GiveawayRequirement.VoiceTime]: (giveaway, subject) =>
  atLeast(giveaway.minVoiceSeconds, subject.voiceSeconds),
};

export const failedRequirements = (giveaway: Giveaway, subject: RequirementSubject) =>
 requirementOrder.filter((requirement) => !predicates[requirement](giveaway, subject));

type Requirements = Translator['requirements'];

const mentions = (roleIds: string[]) =>
 roleIds.length ? roleIds.map((id) => `<@&${id}>`).join(' or ') : null;
const duration = (column: unknown) =>
 column === null ? null : formatDurationSeconds(Number(column));
const count = (column: unknown) => (column === null ? null : String(Number(column)));

interface LineSpec {
 emote: (emotes: EmoteSet) => APIPartialEmoji;
 value: (giveaway: Giveaway) => string | null;
 text: (requirements: Requirements, value: string) => string;
}

const lineSpecs: LineSpec[] = [
 {
  emote: (e) => e.role,
  value: (g) => mentions(g.requiredRoles),
  text: (r, role) => r.role({ role }),
 },
 {
  emote: (e) => e.lock,
  value: (g) => mentions(g.excludedRoles),
  text: (r, role) => r.excluded({ role }),
 },
 {
  emote: (e) => e.calendar,
  value: (g) => duration(g.minAccountSeconds),
  text: (r, time) => r.accountAge({ time }),
 },
 {
  emote: (e) => e.member,
  value: (g) => duration(g.minTenureSeconds),
  text: (r, time) => r.tenure({ time }),
 },
 {
  emote: (e) => e.message,
  value: (g) => count(g.minMessages),
  text: (r, amount) => r.messages({ count: amount }),
 },
 {
  emote: (e) => e.message,
  value: (g) => count(g.minMessagesSince),
  text: (r, amount) => r.messagesSince({ count: amount }),
 },
 {
  emote: (e) => e.channelvoice,
  value: (g) => duration(g.minVoiceSeconds),
  text: (r, time) => r.voiceTime({ time }),
 },
];

const noteSpecs: Record<
 GiveawayRequirement,
 (unmet: Translator['unmet'], giveaway: Giveaway) => string
> = {
 [GiveawayRequirement.Excluded]: (unmet, g) => unmet.excluded({ role: mentions(g.excludedRoles) ?? '' }),
 [GiveawayRequirement.Role]: (unmet, g) => unmet.role({ role: mentions(g.requiredRoles) ?? '' }),
 [GiveawayRequirement.AccountAge]: (unmet, g) =>
  unmet.accountAge({ time: formatDurationSeconds(Number(g.minAccountSeconds)) }),
 [GiveawayRequirement.Tenure]: (unmet, g) =>
  unmet.tenure({ time: formatDurationSeconds(Number(g.minTenureSeconds)) }),
 [GiveawayRequirement.Messages]: (unmet, g) =>
  unmet.messages({ count: String(Number(g.minMessages)) }),
 [GiveawayRequirement.MessagesSince]: (unmet, g) =>
  unmet.messagesSince({ count: String(Number(g.minMessagesSince)) }),
 [GiveawayRequirement.VoiceTime]: (unmet, g) =>
  unmet.voiceTime({ time: formatDurationSeconds(Number(g.minVoiceSeconds)) }),
};

export const requirementNote = (
 t: Translator,
 giveaway: Giveaway,
 failed: GiveawayRequirement[],
) => {
 const [first] = failed;
 return first ? noteSpecs[first](t.unmet, giveaway) : null;
};

export const requirementLines = (t: Translator, emotes: EmoteSet, giveaway: Giveaway) =>
 lineSpecs
  .map((spec) => ({ spec, value: spec.value(giveaway) }))
  .filter((entry): entry is { spec: LineSpec; value: string } => entry.value !== null)
  .map(
   (entry) =>
    `${constants.formatters.getEmote(entry.spec.emote(emotes))} ${entry.spec.text(
     t.requirements,
     entry.value,
    )}`,
  );

export type ActivityColumns = Pick<
 Giveaway,
 'minMessages' | 'minMessagesSince' | 'minVoiceSeconds'
>;

export const needsActivity = (giveaway: ActivityColumns) =>
 giveaway.minMessages !== null ||
 giveaway.minMessagesSince !== null ||
 giveaway.minVoiceSeconds !== null;
