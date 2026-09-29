import { ActivitySource } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import { claimCooldown } from '../../../Util/cooldown.js';
import {
 activityThrottleSeconds,
 CustomRolesKey,
 // TODO: request presence intent for this
 // presenceThrottleSeconds,
 // presenceToleranceMs,
 settingsCacheMs,
} from '../constants.js';
import type CustomRolesPlugin from '../Plugin.js';
// TODO: request presence intent for this
// import { watchWindow } from '../Util/inactivity.js';

interface CachedSources {
 sources: Set<ActivitySource>;
 expires: number;
}

export default class ActivityTracker {
 plugin: CustomRolesPlugin;
 client: Client;

 private cached = new Map<string, CachedSources>();

 constructor(plugin: CustomRolesPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 sourcesFor = async (guildId: string): Promise<Set<ActivitySource>> => {
  const hit = this.cached.get(guildId);
  if (hit && hit.expires > Date.now()) return hit.sources;

  const rows = await this.client.db.client.roleReward.findMany({
   where: { guild: guildId, active: true, customRole: true, inactivityWipe: true },
   select: { activitySources: true },
  });
  const sources = new Set(rows.flatMap((row) => row.activitySources));
  this.cached.set(guildId, { sources, expires: Date.now() + settingsCacheMs });

  return sources;
 };

 record = async (guildId: string, userId: string, source: ActivitySource): Promise<void> => {
  if (!(await this.sourcesFor(guildId)).has(source)) return;

  const db = this.client.cache.cacheDb;
  const key = `${CustomRolesKey.Activity}:${guildId}:${userId}:${source}`;
  if (!(await claimCooldown(db, key, activityThrottleSeconds))) return;

  await this.touch(guildId, userId, source);
  await db.set(`${CustomRolesKey.Observed}:${guildId}:${source}`, String(Date.now()));
 };

 touch = async (
  guildId: string,
  userId: string,
  source: ActivitySource,
  at: Date = new Date(),
 ): Promise<void> => {
  const { count } = await this.client.db.client.lastActive.updateMany({
   where: { guild: guildId, user: userId, source },
   data: { lastActive: at },
  });
  if (count) return;

  await this.client.db.client.lastActive.createMany({
   data: [{ guild: guildId, user: userId, source, lastActive: at }],
   skipDuplicates: true,
  });
 };

 touchAll = async (guildId: string, userId: string): Promise<void> => {
  await Promise.all(
   Object.values(ActivitySource).map((source) => this.touch(guildId, userId, source)),
  );
 };

 forget = async (guildId: string, userId: string): Promise<void> => {
  await this.client.db.client.lastActive.deleteMany({ where: { guild: guildId, user: userId } });
 };

 // TODO: request presence intent for this
 // notePresence = async (guildId: string): Promise<void> => {
 // const db = this.client.cache.cacheDb;
 // const throttle = `${CustomRolesKey.PresenceThrottle}:${guildId}`;
 // if (!(await claimCooldown(db, throttle, presenceThrottleSeconds))) return;
 //
 // const now = Date.now();
 // const beatKey = `${CustomRolesKey.PresenceBeat}:${guildId}`;
 // const sinceKey = `${CustomRolesKey.PresenceSince}:${guildId}`;
 // const [beat, since] = await Promise.all([db.get(beatKey), db.get(sinceKey)]);
 // const state = watchWindow(Number(beat), Number(since), now, presenceToleranceMs);
 //
 // if (state.reset) await db.set(sinceKey, String(now));
 // await db.set(beatKey, String(now));
 // };

 syncTracking = async (guildId: string, rewardId: string): Promise<void> => {
  this.cached.delete(guildId);

  const row = await this.client.db.client.roleReward.findFirst({
   where: { id: rewardId, guild: guildId },
  });
  if (!row) return;

  if (row.inactivityWipe && !row.trackingSince) {
   await this.client.db.client.roleReward.updateMany({
    where: { id: rewardId },
    data: { trackingSince: new Date() },
   });
   return;
  }

  if (!row.inactivityWipe && row.trackingSince) {
   await this.client.db.client.roleReward.updateMany({
    where: { id: rewardId },
    data: { trackingSince: null },
   });
  }
 };
}
