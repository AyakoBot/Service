import type { RMember, RUser } from '@ayako/utility';
import { UserFlags } from 'discord-api-types/v10';

import type { BaseLang } from '../../../Classes/abstracts/Plugin.js';
import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { EmoteName } from '../../../Classes/EmoteName.js';
import { textEmote } from '../../settings/Util/settingsEmotes.js';

export type Badge = {
 flag: bigint;
 emote: EmoteName;
 label: (base: BaseLang) => string;
};

export const badgeList: Badge[] = [
 {
  flag: BigInt(UserFlags.Staff),
  emote: EmoteName.FlagStaff,
  label: (base) => base.userFlags.Staff(),
 },
 {
  flag: BigInt(UserFlags.Partner),
  emote: EmoteName.FlagPartner,
  label: (base) => base.userFlags.Partner(),
 },
 {
  flag: BigInt(UserFlags.Hypesquad),
  emote: EmoteName.FlagHypesquad,
  label: (base) => base.userFlags.Hypesquad(),
 },
 {
  flag: BigInt(UserFlags.BugHunterLevel1),
  emote: EmoteName.FlagBugHunter1,
  label: (base) => base.userFlags.BugHunterLevel1(),
 },
 {
  flag: BigInt(UserFlags.HypeSquadOnlineHouse1),
  emote: EmoteName.FlagBravery,
  label: (base) => base.userFlags.HypeSquadOnlineHouse1(),
 },
 {
  flag: BigInt(UserFlags.HypeSquadOnlineHouse2),
  emote: EmoteName.FlagBrilliance,
  label: (base) => base.userFlags.HypeSquadOnlineHouse2(),
 },
 {
  flag: BigInt(UserFlags.HypeSquadOnlineHouse3),
  emote: EmoteName.FlagBalance,
  label: (base) => base.userFlags.HypeSquadOnlineHouse3(),
 },
 {
  flag: BigInt(UserFlags.PremiumEarlySupporter),
  emote: EmoteName.FlagEarlySupporter,
  label: (base) => base.userFlags.PremiumEarlySupporter(),
 },
 {
  flag: BigInt(UserFlags.BugHunterLevel2),
  emote: EmoteName.FlagBugHunter2,
  label: (base) => base.userFlags.BugHunterLevel2(),
 },
 {
  flag: BigInt(UserFlags.VerifiedBot),
  emote: EmoteName.FlagVerifiedBot,
  label: (base) => base.userFlags.VerifiedBot(),
 },
 {
  flag: BigInt(UserFlags.VerifiedDeveloper),
  emote: EmoteName.FlagVerifiedDeveloper,
  label: (base) => base.userFlags.VerifiedDeveloper(),
 },
 {
  flag: BigInt(UserFlags.CertifiedModerator),
  emote: EmoteName.FlagCertifiedModerator,
  label: (base) => base.userFlags.CertifiedModerator(),
 },
 {
  flag: BigInt(UserFlags.BotHTTPInteractions),
  emote: EmoteName.FlagBot,
  label: (base) => base.userFlags.BotHTTPInteractions(),
 },
 {
  flag: BigInt(UserFlags.ActiveDeveloper),
  emote: EmoteName.FlagActiveDeveloper,
  label: (base) => base.userFlags.ActiveDeveloper(),
 },
];

const monthMs = 30 * 24 * 60 * 60 * 1000;

const boostTiers: { months: number; emote: EmoteName; label: (base: BaseLang) => string }[] = [
 { months: 24, emote: EmoteName.Boost24, label: (base) => base.userFlags.Boost24() },
 { months: 18, emote: EmoteName.Boost18, label: (base) => base.userFlags.Boost18() },
 { months: 15, emote: EmoteName.Boost15, label: (base) => base.userFlags.Boost15() },
 { months: 12, emote: EmoteName.Boost12, label: (base) => base.userFlags.Boost12() },
 { months: 9, emote: EmoteName.Boost9, label: (base) => base.userFlags.Boost9() },
 { months: 6, emote: EmoteName.Boost6, label: (base) => base.userFlags.Boost6() },
 { months: 3, emote: EmoteName.Boost3, label: (base) => base.userFlags.Boost3() },
 { months: 2, emote: EmoteName.Boost2, label: (base) => base.userFlags.Boost2() },
 { months: 0, emote: EmoteName.Boost1, label: (base) => base.userFlags.Boost1() },
];

export const boostBadge = (member: RMember | null | undefined) => {
 if (!member?.premium_since) return null;
 const months = (Date.now() - new Date(member.premium_since).getTime()) / monthMs;
 return boostTiers.find((tier) => months >= tier.months) ?? null;
};

export const hasNitroIndicator = (user: RUser): boolean =>
 Boolean(user.avatar_url?.endsWith('.gif') || user.banner_url);

export const userBadgeLines = (
 emotes: EmoteSet,
 base: BaseLang,
 user: RUser,
 member: RMember | null | undefined,
): string[] => {
 const flags = BigInt(user.public_flags ?? user.flags ?? 0);
 const lines = badgeList
  .filter((badge) => (flags & badge.flag) === badge.flag)
  .map((badge) => `${textEmote(emotes.get(badge.emote))} ${badge.label(base)}`);

 if (user.bot && !((flags & BigInt(UserFlags.VerifiedBot)) === BigInt(UserFlags.VerifiedBot))) {
  lines.push(`${textEmote(emotes.userFlags.bot)} ${base.userFlags.Bot()}`);
 }
 if (!user.bot && hasNitroIndicator(user)) {
  lines.push(`${textEmote(emotes.userFlags.nitro)} ${base.userFlags.Nitro()}`);
 }

 const boost = boostBadge(member);
 if (boost) lines.push(`${textEmote(emotes.get(boost.emote))} ${boost.label(base)}`);

 return lines;
};
