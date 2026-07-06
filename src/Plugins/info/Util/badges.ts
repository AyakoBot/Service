import type { RMember, RUser } from '@ayako/utility';
import type { APIPartialEmoji } from '@discordjs/core';
import { UserFlags } from 'discord-api-types/v10';

import type { BaseLang } from '../../../Classes/abstracts/Plugin.js';
import emotes from '../../../Classes/Emotes.js';
import { textEmote } from '../../settings/Util/settingsEmotes.js';

export type Badge = {
 flag: bigint;
 emote: APIPartialEmoji;
 label: (base: BaseLang) => string;
};

export const badgeList: Badge[] = [
 {
  flag: BigInt(UserFlags.Staff),
  emote: emotes.userFlags.discordEmployee,
  label: (base) => base.userFlags.Staff(),
 },
 {
  flag: BigInt(UserFlags.Partner),
  emote: emotes.userFlags.partneredServerOwner,
  label: (base) => base.userFlags.Partner(),
 },
 {
  flag: BigInt(UserFlags.Hypesquad),
  emote: emotes.userFlags.hypesquadEvents,
  label: (base) => base.userFlags.Hypesquad(),
 },
 {
  flag: BigInt(UserFlags.BugHunterLevel1),
  emote: emotes.userFlags.bugHunterLevel1,
  label: (base) => base.userFlags.BugHunterLevel1(),
 },
 {
  flag: BigInt(UserFlags.HypeSquadOnlineHouse1),
  emote: emotes.userFlags.houseBravery,
  label: (base) => base.userFlags.HypeSquadOnlineHouse1(),
 },
 {
  flag: BigInt(UserFlags.HypeSquadOnlineHouse2),
  emote: emotes.userFlags.houseBrilliance,
  label: (base) => base.userFlags.HypeSquadOnlineHouse2(),
 },
 {
  flag: BigInt(UserFlags.HypeSquadOnlineHouse3),
  emote: emotes.userFlags.houseBalance,
  label: (base) => base.userFlags.HypeSquadOnlineHouse3(),
 },
 {
  flag: BigInt(UserFlags.PremiumEarlySupporter),
  emote: emotes.userFlags.earlySupporter,
  label: (base) => base.userFlags.PremiumEarlySupporter(),
 },
 {
  flag: BigInt(UserFlags.BugHunterLevel2),
  emote: emotes.userFlags.bugHunterLevel2,
  label: (base) => base.userFlags.BugHunterLevel2(),
 },
 {
  flag: BigInt(UserFlags.VerifiedBot),
  emote: emotes.userFlags.verifiedBot[0],
  label: (base) => base.userFlags.VerifiedBot(),
 },
 {
  flag: BigInt(UserFlags.VerifiedDeveloper),
  emote: emotes.userFlags.earlyVerifiedBotDeveloper,
  label: (base) => base.userFlags.VerifiedDeveloper(),
 },
 {
  flag: BigInt(UserFlags.CertifiedModerator),
  emote: emotes.userFlags.discordCertifiedModerator,
  label: (base) => base.userFlags.CertifiedModerator(),
 },
 {
  flag: BigInt(UserFlags.BotHTTPInteractions),
  emote: emotes.userFlags.bot,
  label: (base) => base.userFlags.BotHTTPInteractions(),
 },
 {
  flag: BigInt(UserFlags.ActiveDeveloper),
  emote: emotes.userFlags.activeDeveloper,
  label: (base) => base.userFlags.ActiveDeveloper(),
 },
];

const monthMs = 30 * 24 * 60 * 60 * 1000;

const boostTiers: { months: number; emote: APIPartialEmoji; label: (base: BaseLang) => string }[] =
 [
  { months: 24, emote: emotes.userFlags.boost24, label: (base) => base.userFlags.Boost24() },
  { months: 18, emote: emotes.userFlags.boost18, label: (base) => base.userFlags.Boost18() },
  { months: 15, emote: emotes.userFlags.boost15, label: (base) => base.userFlags.Boost15() },
  { months: 12, emote: emotes.userFlags.boost12, label: (base) => base.userFlags.Boost12() },
  { months: 9, emote: emotes.userFlags.boost9, label: (base) => base.userFlags.Boost9() },
  { months: 6, emote: emotes.userFlags.boost6, label: (base) => base.userFlags.Boost6() },
  { months: 3, emote: emotes.userFlags.boost3, label: (base) => base.userFlags.Boost3() },
  { months: 2, emote: emotes.userFlags.boost2, label: (base) => base.userFlags.Boost2() },
  { months: 0, emote: emotes.userFlags.boost1, label: (base) => base.userFlags.Boost1() },
 ];

export const boostBadge = (member: RMember | null | undefined) => {
 if (!member?.premium_since) return null;
 const months = (Date.now() - new Date(member.premium_since).getTime()) / monthMs;
 return boostTiers.find((tier) => months >= tier.months) ?? null;
};

export const hasNitroIndicator = (user: RUser): boolean =>
 Boolean(user.avatar_url?.endsWith('.gif') || user.banner_url);

export const userBadgeLines = (
 base: BaseLang,
 user: RUser,
 member: RMember | null | undefined,
): string[] => {
 const flags = BigInt(user.public_flags ?? user.flags ?? 0);
 const lines = badgeList
  .filter((badge) => (flags & badge.flag) === badge.flag)
  .map((badge) => `${textEmote(badge.emote)} ${badge.label(base)}`);

 if (user.bot && !((flags & BigInt(UserFlags.VerifiedBot)) === BigInt(UserFlags.VerifiedBot))) {
  lines.push(`${textEmote(emotes.userFlags.bot)} ${base.userFlags.Bot()}`);
 }
 if (!user.bot && hasNitroIndicator(user)) {
  lines.push(`${textEmote(emotes.userFlags.nitro)} ${base.userFlags.Nitro()}`);
 }

 const boost = boostBadge(member);
 if (boost) lines.push(`${textEmote(boost.emote)} ${boost.label(base)}`);

 return lines;
};
