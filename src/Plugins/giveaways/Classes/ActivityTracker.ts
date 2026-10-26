import type { GiveawayActivity, GiveawayEntryActivity } from '@ayako/database';
import { getPathFromError, type RGuild } from '@ayako/utility';
import { scheduleJob } from 'node-schedule';

import type GiveawaysPlugin from '../Plugin.js';
import { inScope, rulesFrom, voiceCounts, type TrackingRules } from '../Util/activityScope.js';

export interface ActivitySnapshot {
 messages: number;
 messagesSince: number;
 voiceSeconds: number;
}

interface GuildTally {
 guild: string;
 user: string;
 messages: number;
 voiceSeconds: number;
}

interface EntryTally {
 message: string;
 user: string;
 messages: number;
}

const flushCron = '*/30 * * * * *';
const refreshCron = '0 * * * * *';
const pruneCron = '0 0 4 * * *';
const voiceCreditSeconds = 60;
const retentionMs = 30 * 24 * 60 * 60 * 1000;

const tallyKey = (scope: string, user: string) => `${scope}:${user}`;

const emptySnapshot = (): ActivitySnapshot => ({ messages: 0, messagesSince: 0, voiceSeconds: 0 });

const ruleColumns = {
 guild: true,
 messageChannels: true,
 voiceChannels: true,
 voiceCountMuted: true,
 voiceCountDeafened: true,
 voiceMinMembers: true,
} as const;

const applyRows = (
 snapshots: Map<string, ActivitySnapshot>,
 totals: GiveawayActivity[],
 since: GiveawayEntryActivity[],
) => {
 totals.forEach((row) => {
  const snapshot = snapshots.get(row.user);
  if (!snapshot) return;

  snapshot.messages = Number(row.messages);
  snapshot.voiceSeconds = Number(row.voiceSeconds);
 });

 since.forEach((row) => {
  const snapshot = snapshots.get(row.user);
  if (snapshot) snapshot.messagesSince = Number(row.messages);
 });
};

export default class GiveawayActivityTracker {
 plugin: GiveawaysPlugin;

 private tracked = new Map<string, TrackingRules>();
 private entryTargets = new Map<string, string[]>();
 private tally = new Map<string, GuildTally>();
 private entryTally = new Map<string, EntryTally>();

 constructor(plugin: GiveawaysPlugin) {
  this.plugin = plugin;
 }

 start = () => {
  this.refresh().catch((error) => this.plugin.nonFatalError(error as Error, 'activityRefresh'));

  scheduleJob(getPathFromError(new Error()), flushCron, () =>
   this.flush().catch((error) => this.plugin.nonFatalError(error as Error, 'activityFlush')),
  );
  scheduleJob(getPathFromError(new Error()), refreshCron, () =>
   this.minuteTick().catch((error) => this.plugin.nonFatalError(error as Error, 'activityTick')),
  );
  scheduleJob(getPathFromError(new Error()), pruneCron, () =>
   this.prune().catch((error) => this.plugin.nonFatalError(error as Error, 'activityPrune')),
  );
 };

 onMessage = async (guildId: string, userId: string, channelId: string) => {
  const rules = this.tracked.get(guildId);
  if (!rules) return;
  if (
   rules.messageChannels.length &&
   !inScope(rules.messageChannels, await this.chainOf(channelId))
  ) {
   return;
  }

  this.bumpGuild(guildId, userId, 1, 0);
  this.entryTargets.get(guildId)?.forEach((message) => this.bumpEntry(message, userId));
 };

 trackedGuilds = () => new Set(this.tracked.keys());

 private rulesFor = async (guildId: string) => {
  if (!this.plugin.isLiveFor(guildId)) return null;

  const row = await this.plugin.client.db.client.giveawaySetting.findFirst({
   where: { guild: guildId, trackActivity: true },
   select: ruleColumns,
  });

  return row ? rulesFrom(row) : null;
 };

 tracks = async (guildId: string) => !!(await this.rulesFor(guildId));

 refreshGuild = async (guildId: string) => {
  const rules = await this.rulesFor(guildId);
  if (rules) this.tracked.set(guildId, rules);
  else this.tracked.delete(guildId);
 };

 private chainOf = async (channelId: string) => {
  if (!channelId) return [];

  const { cache } = this.plugin.client;
  const thread = await cache.threads.get(channelId);
  const channel = await cache.channels.get(thread?.parent_id ?? channelId);

  return [channelId, thread?.parent_id, channel?.parent_id];
 };

 activityFor = async (
  guildId: string,
  messageId: string,
  userIds: string[],
 ): Promise<Map<string, ActivitySnapshot>> => {
  const snapshots = new Map<string, ActivitySnapshot>(
   userIds.map((user) => [user, emptySnapshot()]),
  );
  if (!userIds.length) return snapshots;

  const { client } = this.plugin;
  const [totals, since] = await Promise.all([
   client.db.client.giveawayActivity.findMany({
    where: { guild: guildId, user: { in: userIds } },
   }),
   client.db.client.giveawayEntryActivity.findMany({
    where: { message: messageId, user: { in: userIds } },
   }),
  ]);

  applyRows(snapshots, totals, since);
  this.mergePending(snapshots, guildId, messageId);
  return snapshots;
 };

 private mergePending = (
  snapshots: Map<string, ActivitySnapshot>,
  guildId: string,
  messageId: string,
 ) => {
  snapshots.forEach((snapshot, user) => {
   const pending = this.tally.get(tallyKey(guildId, user));
   if (pending) {
    snapshot.messages += pending.messages;
    snapshot.voiceSeconds += pending.voiceSeconds;
   }

   const pendingSince = this.entryTally.get(tallyKey(messageId, user));
   if (pendingSince) snapshot.messagesSince += pendingSince.messages;
  });
 };

 private bumpGuild = (guild: string, user: string, messages: number, voiceSeconds: number) => {
  const key = tallyKey(guild, user);
  const tally = this.tally.get(key) ?? { guild, user, messages: 0, voiceSeconds: 0 };

  tally.messages += messages;
  tally.voiceSeconds += voiceSeconds;
  this.tally.set(key, tally);
 };

 private bumpEntry = (message: string, user: string) => {
  const key = tallyKey(message, user);
  const tally = this.entryTally.get(key) ?? { message, user, messages: 0 };

  tally.messages += 1;
  this.entryTally.set(key, tally);
 };

 forgetGuild = (guildId: string) => {
  this.tracked.delete(guildId);
  this.entryTargets.delete(guildId);
  this.tally.forEach((tally, key) => {
   if (tally.guild === guildId) this.tally.delete(key);
  });
 };

 forgetMessages = (messageIds: string[]) => {
  const dead = new Set(messageIds);

  this.entryTally.forEach((tally, key) => {
   if (dead.has(tally.message)) this.entryTally.delete(key);
  });
  this.entryTargets.forEach((messages, guild) =>
   this.entryTargets.set(
    guild,
    messages.filter((message) => !dead.has(message)),
   ),
  );
 };

 private restoreGuild = (tallies: GuildTally[]) => {
  tallies.forEach((tally) => {
   const current = this.tally.get(tallyKey(tally.guild, tally.user));
   if (!current) {
    this.tally.set(tallyKey(tally.guild, tally.user), tally);
    return;
   }

   current.messages += tally.messages;
   current.voiceSeconds += tally.voiceSeconds;
  });
 };

 private restoreEntry = (tallies: EntryTally[]) => {
  tallies.forEach((tally) => {
   const current = this.entryTally.get(tallyKey(tally.message, tally.user));
   if (!current) {
    this.entryTally.set(tallyKey(tally.message, tally.user), tally);
    return;
   }

   current.messages += tally.messages;
  });
 };

 private flush = async () => {
  const guildTallies = [...this.tally.values()];
  const entryTallies = [...this.entryTally.values()];
  if (!guildTallies.length && !entryTallies.length) return;

  this.tally = new Map();
  this.entryTally = new Map();

  const results = await Promise.allSettled([
   this.flushGuildTallies(guildTallies).catch((error) => {
    this.restoreGuild(guildTallies);
    throw error;
   }),
   this.flushEntryTallies(entryTallies).catch((error) => {
    this.restoreEntry(entryTallies);
    throw error;
   }),
  ]);

  const failed = results.find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
 };

 private liveMessages = async (messageIds: string[]) => {
  const rows = await this.plugin.client.db.client.giveaway.findMany({
   where: { message: { in: messageIds } },
   select: { message: true },
  });

  return new Set(rows.map((row) => row.message));
 };

 private flushGuildTallies = async (tallies: GuildTally[]) => {
  if (!tallies.length) return;

  const { client } = this.plugin;
  await client.db.client.$transaction(
   tallies.map((tally) =>
    client.db.client.giveawayActivity.upsert({
     where: { guild_user: { guild: tally.guild, user: tally.user } },
     create: {
      guild: tally.guild,
      user: tally.user,
      messages: tally.messages,
      voiceSeconds: tally.voiceSeconds,
     },
     update: {
      messages: { increment: tally.messages },
      voiceSeconds: { increment: tally.voiceSeconds },
     },
    }),
   ),
  );
 };

 private flushEntryTallies = async (raw: EntryTally[]) => {
  if (!raw.length) return;

  const live = await this.liveMessages([...new Set(raw.map((tally) => tally.message))]);
  const tallies = raw.filter((tally) => live.has(tally.message));
  if (!tallies.length) return;

  const { client } = this.plugin;
  await client.db.client.$transaction(
   tallies.map((tally) =>
    client.db.client.giveawayEntryActivity.upsert({
     where: { message_user: { message: tally.message, user: tally.user } },
     create: { message: tally.message, user: tally.user, messages: tally.messages },
     update: { messages: { increment: tally.messages } },
    }),
   ),
  );
 };

 private minuteTick = async () => {
  await this.refresh();

  const { client } = this.plugin;
  const guilds = (await client.cache.guilds.getAll()).filter((guild) => this.tracked.has(guild.id));
  if (!guilds.length) return;

  await Promise.all(guilds.map((guild) => this.creditVoice(guild)));
 };

 private creditVoice = async (guild: RGuild) => {
  // ponytail: single-instance sweep; wrap the tick in SET NX if Service scales out
  const rules = this.tracked.get(guild.id);
  if (!rules) return;

  const { client } = this.plugin;
  const voices = (await client.cache.voices.getAll(guild.id)).filter(
   (voice) => voice.channel_id && voice.channel_id !== guild.afk_channel_id,
  );
  const humans = (
   await Promise.all(
    voices.map(async (voice) => ((await client.cache.users.get(voice.user_id))?.bot ? null : voice)),
   )
  ).filter((voice) => voice !== null);

  const present = new Map<string, number>();
  humans.forEach((voice) =>
   present.set(voice.channel_id as string, (present.get(voice.channel_id as string) ?? 0) + 1),
  );

  for (const voice of humans) {
   const channelId = voice.channel_id as string;
   if ((present.get(channelId) ?? 0) < rules.minMembers) continue;
   if (!voiceCounts(voice, rules)) continue;
   if (rules.voiceChannels.length && !inScope(rules.voiceChannels, await this.chainOf(channelId))) {
    continue;
   }

   this.bumpGuild(guild.id, voice.user_id, 0, voiceCreditSeconds);
  }
 };

 private refresh = async () => {
  await Promise.all([this.refreshTracked(), this.refreshEntryTargets()]);
 };

 private refreshTracked = async () => {
  const { client } = this.plugin;
  const rows = await client.db.client.giveawaySetting.findMany({
   where: { trackActivity: true },
   select: ruleColumns,
  });

  this.tracked = new Map(
   rows
    .filter((row) => this.plugin.isLiveFor(row.guild))
    .map((row) => [row.guild, rulesFrom(row)] as const),
  );
 };

 private refreshEntryTargets = async () => {
  const { client } = this.plugin;
  const rows = await client.db.client.giveaway.findMany({
   where: {
    ended: false,
    cancelled: false,
    minMessagesSince: { not: null },
   },
   select: { guild: true, message: true },
  });

  const targets = new Map<string, string[]>();
  rows
   .filter((row) => this.plugin.isLiveFor(row.guild))
   .forEach((row) => targets.set(row.guild, [...(targets.get(row.guild) ?? []), row.message]));
  this.entryTargets = targets;
 };

 private prune = async () => {
  const { client } = this.plugin;
  const where = {
   ended: true,
   minMessagesSince: { not: null },
   endTime: { lt: new Date(Date.now() - retentionMs) },
  };

  const stale = await client.db.client.giveaway.findMany({ where, select: { message: true } });
  if (!stale.length) return;

  const messages = stale.map((row) => row.message);

  await client.db.client.$transaction([
   client.db.client.giveawayEntryActivity.deleteMany({ where: { message: { in: messages } } }),
   client.db.client.giveaway.updateMany({
    where: { message: { in: messages } },
    data: { minMessagesSince: null },
   }),
  ]);
 };
}
