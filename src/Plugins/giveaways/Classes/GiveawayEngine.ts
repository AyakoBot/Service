import { RequestHandlerError } from '@ayako/api';
import type { Giveaway } from '@ayako/database';
import { MessageFlags } from 'discord-api-types/v10';

import { MessagePayload } from '../../../Classes/abstracts/MessagePayload.js';
import type Client from '../../../Classes/Client.js';
import { arm, disarm, isArmed, stripMarkerPrefix } from '../../../Util/schedule.js';
import { origin } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';
import { bonusSnapshot, entriesFor } from '../Util/bonusEntries.js';
import { buildAnnouncement, hasClaimFlow, pingedWinners } from '../Util/container.js';
import { drawWeighted, excluding, planReroll } from '../Util/draw.js';
import renderGiveaway, { cancelRender } from '../Util/render.js';
import { failedRequirements, needsActivity } from '../Util/requirements.js';

const endPrefix = 'giveaways:end:';
const claimPrefix = 'giveaways:claim:';

const endKey = (guildId: string, messageId: string) => `${endPrefix}${guildId}:${messageId}`;
const claimKey = (guildId: string, messageId: string) => `${claimPrefix}${guildId}:${messageId}`;

const parseKey = (key: string, prefix: string): string | null => {
 if (!key.startsWith(prefix)) return null;
 const [guildId, messageId] = key.slice(prefix.length).split(':');
 return guildId && messageId ? messageId : null;
};

const emptyActivity = { messages: 0, messagesSince: 0, voiceSeconds: 0 };

interface RequirementMember {
 roles: string[];
 joinedAt: string | null;
}

export type DeletedWhere = { message: string | { in: string[] } } | { channel: string };

export const canReroll = (giveaway: Giveaway) =>
 !(hasClaimFlow(giveaway) && giveaway.claimingDone && !giveaway.unclaimedWinners.length);

export default class GiveawayEngine {
 plugin: GiveawaysPlugin;
 client: Client;

 constructor(plugin: GiveawaysPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 armEnd = async (giveaway: Giveaway) => {
  await arm.call(
   this.client,
   endKey(giveaway.guild, giveaway.message),
   '1',
   (giveaway.endTime.getTime() - Date.now()) / 1000,
  );
 };

 disarmAll = async (giveaway: Giveaway) => {
  await disarm.call(this.client, endKey(giveaway.guild, giveaway.message));
  await disarm.call(this.client, claimKey(giveaway.guild, giveaway.message));
 };

 cancelDeleted = async (where: DeletedWhere) => {
  const rows = await this.client.db.client.giveaway.findMany({ where });
  if (!rows.length) return;

  this.plugin.activity.forgetMessages(rows.map((row) => row.message));

  for (const giveaway of rows) {
   cancelRender(giveaway.message);
   await this.disarmAll(giveaway);
  }

  const running = rows.filter((row) => !row.ended);
  if (!running.length) return;

  await this.client.db.client.giveaway.updateMany({
   where: { message: { in: running.map((row) => row.message) } },
   data: { ended: true, cancelled: true },
  });
  await Promise.all(
   running.map((row) => this.plugin.logs.cancelled({ ...row, ended: true, cancelled: true })),
  );
 };

 end = async (messageId: string) => {
  const giveaway = await this.client.db.client.giveaway.findFirst({
   where: { message: messageId, ended: false, cancelled: false },
  });
  if (!giveaway) return false;

  await this.plugin.logs.ended(await this.runDraw(giveaway, false));
  return true;
 };

 reroll = async (messageId: string, count?: number) => {
  const giveaway = await this.client.db.client.giveaway.findFirst({
   where: { message: messageId, ended: true, cancelled: false },
  });
  if (!giveaway || !canReroll(giveaway)) return false;

  const updated =
   count && count < giveaway.winners.length
    ? await this.runPartialReroll(giveaway, count)
    : await this.runDraw(giveaway, true);

  await this.plugin.logs.rerolled(updated);
  return true;
 };

 rearmClaim = async (giveaway: Giveaway): Promise<Giveaway> => {
  const key = claimKey(giveaway.guild, giveaway.message);
  const seconds = Number(giveaway.collectSeconds);

  if (!hasClaimFlow(giveaway) || !seconds) {
   await disarm.call(this.client, key);
   return giveaway;
  }

  const updated = await this.client.db.client.giveaway.update({
   where: { message: giveaway.message },
   data: { claimUntil: new Date(Date.now() + seconds * 1000) },
  });
  await arm.call(this.client, key, '1', seconds);

  return updated;
 };

 deleteAnnouncement = async (giveaway: Giveaway) => {
  if (!giveaway.announceMessage) return;

  const api = await this.plugin.api(giveaway.guild);
  const res = await api.channels.deleteMessage(giveaway.channel, giveaway.announceMessage, {
   origin,
   reason: 'Replacing giveaway winner announcement',
  });
  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'deleteAnnouncement');
 };

 onScheduleExpired = async (rawKey: string) => {
  if (!this.plugin.isEnabled()) return;

  const key = stripMarkerPrefix(rawKey);

  const endedMessage = parseKey(key, endPrefix);
  if (endedMessage) {
   await this.end(endedMessage).catch((e: Error) => this.plugin.nonFatalError(e, 'scheduled end'));
   return;
  }

  const claimMessage = parseKey(key, claimPrefix);
  if (!claimMessage) return;
  await this.onClaimExpired(claimMessage).catch((e: Error) =>
   this.plugin.nonFatalError(e, 'scheduled claim expiry'),
  );
 };

 reconcile = async () => {
  if (!this.client.cache.scheduleDb) return;

  const running = await this.client.db.client.giveaway.findMany({
   where: { ended: false, cancelled: false },
  });
  for (const giveaway of running) {
   if (giveaway.endTime.getTime() <= Date.now()) {
    await this.end(giveaway.message).catch((e: Error) =>
     this.plugin.nonFatalError(e, 'reconcile end'),
    );
   } else if (!(await isArmed.call(this.client, endKey(giveaway.guild, giveaway.message)))) {
    await this.armEnd(giveaway);
   }
  }

  const claiming = await this.client.db.client.giveaway.findMany({
   where: { ended: true, cancelled: false, claimingDone: false },
  });
  for (const giveaway of claiming) {
   if (!giveaway.unclaimedWinners.length || !giveaway.claimUntil) continue;

   const seconds = (giveaway.claimUntil.getTime() - Date.now()) / 1000;
   if (seconds <= 0) {
    await this.onClaimExpired(giveaway.message).catch((e: Error) =>
     this.plugin.nonFatalError(e, 'reconcile claim expiry'),
    );
   } else if (!(await isArmed.call(this.client, claimKey(giveaway.guild, giveaway.message)))) {
    await arm.call(this.client, claimKey(giveaway.guild, giveaway.message), '1', seconds);
   }
  }
 };

 private runDraw = async (giveaway: Giveaway, excludePreviousWinners: boolean) => {
  const weights = await this.eligibleWeights(giveaway);
  const rerollPool = excluding(weights, giveaway.winners);
  const pool = excludePreviousWinners && rerollPool.size ? rerollPool : weights;
  const winners = drawWeighted(pool, Number(giveaway.winnerCount));

  return this.applyDraw(giveaway, winners, winners, winners);
 };

 private runPartialReroll = async (giveaway: Giveaway, count: number) => {
  const weights = await this.eligibleWeights(giveaway);
  const { kept, keptUnclaimed, freshCount } = planReroll(
   giveaway.winners,
   giveaway.unclaimedWinners,
   Number(giveaway.winnerCount),
   count,
  );

  const rerollPool = excluding(weights, giveaway.winners);
  const pool = rerollPool.size ? rerollPool : excluding(weights, kept);
  const fresh = drawWeighted(pool, freshCount);

  return this.applyDraw(giveaway, [...kept, ...fresh], [...keptUnclaimed, ...fresh], fresh);
 };

 private applyDraw = async (
  giveaway: Giveaway,
  winners: string[],
  unclaimed: string[],
  notify: string[],
 ): Promise<Giveaway> => {
  const claiming = hasClaimFlow(giveaway) && !!winners.length;

  await disarm.call(this.client, endKey(giveaway.guild, giveaway.message));
  await this.deleteAnnouncement(giveaway);

  const updated = await this.client.db.client.giveaway.update({
   where: { message: giveaway.message },
   data: {
    winners,
    ended: true,
    claimingDone: false,
    forfeited: [],
    unclaimedWinners: claiming ? unclaimed : [],
    claimUntil: claiming ? new Date(Date.now() + Number(giveaway.collectSeconds) * 1000) : null,
    announceMessage: null,
   },
  });

  if (claiming) {
   await arm.call(
    this.client,
    claimKey(updated.guild, updated.message),
    '1',
    Number(updated.collectSeconds),
   );
  }

  await this.plugin.rewards.revokeRoles(
   updated,
   giveaway.winners.filter((w) => !winners.includes(w) && giveaway.rewarded.includes(w)),
  );
  await this.plugin.prizes.sync(updated.message);
  await renderGiveaway.call(this.plugin, updated);
  if (winners.length) {
   await this.announce(updated);
   await this.plugin.logs.notifyWinners(updated, notify);
  }

  return updated;
 };

 private onClaimExpired = async (messageId: string) => {
  const giveaway = await this.client.db.client.giveaway.findFirst({
   where: { message: messageId, ended: true, cancelled: false, claimingDone: false },
  });
  if (!giveaway || !giveaway.unclaimedWinners.length) return;

  const forfeited = [...new Set([...giveaway.forfeited, ...giveaway.unclaimedWinners])];
  const seconds = Number(giveaway.collectSeconds);
  const weights =
   giveaway.failReroll && hasClaimFlow(giveaway)
    ? await this.eligibleWeights(giveaway)
    : new Map<string, number>();
  const candidates = excluding(weights, [...giveaway.winners, ...forfeited]);

  await this.deleteAnnouncement(giveaway);

  if (!candidates.size) {
   const updated = await this.client.db.client.giveaway.update({
    where: { message: giveaway.message },
    data: { claimingDone: true, forfeited, announceMessage: null },
   });
   await renderGiveaway.call(this.plugin, updated);
   await this.plugin.logs.claimExpired(updated);
   return;
  }

  const fresh = drawWeighted(candidates, giveaway.unclaimedWinners.length);
  const kept = giveaway.winners.filter((w) => !giveaway.unclaimedWinners.includes(w));

  const updated = await this.client.db.client.giveaway.update({
   where: { message: giveaway.message },
   data: {
    winners: [...kept, ...fresh],
    unclaimedWinners: fresh,
    forfeited,
    claimUntil: new Date(Date.now() + seconds * 1000),
    announceMessage: null,
   },
  });

  await arm.call(this.client, claimKey(updated.guild, updated.message), '1', seconds);

  await this.plugin.prizes.sync(updated.message);
  await renderGiveaway.call(this.plugin, updated);
  await this.announce(updated);
  await this.plugin.logs.notifyWinners(updated, fresh);
  await this.plugin.logs.claimExpired(updated);
 };

 resolveMember = async (guildId: string, userId: string): Promise<RequirementMember | null> => {
  const cached = await this.client.cache.members.get(guildId, userId);
  if (cached) return { roles: cached.roles, joinedAt: cached.joined_at ?? null };

  const api = await this.plugin.api(guildId);
  const fetched = await api.guilds.getMember(guildId, userId, {
   origin,
   reason: 'Checking giveaway entry requirements',
  });
  if (fetched instanceof RequestHandlerError) return null;

  return { roles: fetched.roles, joinedAt: fetched.joined_at ?? null };
 };

 private eligibleWeights = async (giveaway: Giveaway): Promise<Map<string, number>> => {
  const unique = [...new Set(giveaway.participants)];
  if (!unique.length) return new Map();

  const [snapshot, activity] = await Promise.all([
   bonusSnapshot.call(this.plugin, giveaway.message),
   needsActivity(giveaway)
    ? this.plugin.activity.activityFor(giveaway.guild, giveaway.message, unique)
    : new Map<string, typeof emptyActivity>(),
  ]);

  const checks = await Promise.all(
   unique.map(async (userId) => {
    const member = await this.resolveMember(giveaway.guild, userId);
    if (!member) return null;

    const subject = {
     userId,
     roles: member.roles,
     joinedAt: member.joinedAt,
     ...(activity.get(userId) ?? emptyActivity),
    };
    if (failedRequirements(giveaway, subject).length) return null;

    return [userId, entriesFor(member.roles, snapshot)] as [string, number];
   }),
  );

  return new Map(checks.filter((entry): entry is [string, number] => !!entry));
 };

 private announce = async (giveaway: Giveaway) => {
  const t = await this.plugin.t(giveaway.guild);
  const api = await this.plugin.api(giveaway.guild);
  const emotes = this.client.emojis.for(api);

  const payload = new MessagePayload(this.client, { origin, reason: t.end.reason() })
   .setFlags(MessageFlags.IsComponentsV2)
   .setComponents(buildAnnouncement.call(this.plugin, t, emotes, giveaway))
   .setAllowedMentionsUsers(pingedWinners(giveaway));

  const message = await api.channels.createMessage(giveaway.channel, payload.getAPIPayload(), {
   origin,
   reason: t.end.reason(),
  });
  if (message instanceof RequestHandlerError) {
   this.plugin.nonFatalError(message, 'announceWinners');
   return;
  }

  await this.client.db.client.giveaway.update({
   where: { message: giveaway.message },
   data: { announceMessage: message.id },
  });
 };
}
