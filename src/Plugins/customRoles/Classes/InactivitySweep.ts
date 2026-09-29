import { ActivitySource, type RoleReward } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import { arm, isArmed, stripMarkerPrefix } from '../../../Util/schedule.js';
import {
 CustomRolesKey,
 CustomRolesReason,
 inactivitySweepSeconds,
 presenceToleranceMs,
 watchToleranceMs,
} from '../constants.js';
import type CustomRolesPlugin from '../Plugin.js';
import {
 coverageStart,
 shouldWipe,
 watchWindow,
 type RewardPolicy,
} from '../Util/inactivity.js';

interface GuildSignals {
 observed: Map<string, number>;
 presenceBeat: number;
 presenceSince: number;
}

export default class InactivitySweep {
 plugin: CustomRolesPlugin;
 client: Client;

 constructor(plugin: CustomRolesPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 arm = async (): Promise<void> => {
  if (await isArmed.call(this.client, CustomRolesKey.Inactivity)) return;

  await arm.call(this.client, CustomRolesKey.Inactivity, '', inactivitySweepSeconds);
 };

 onScheduleExpired = async (rawKey: string): Promise<void> => {
  if (stripMarkerPrefix(rawKey) !== CustomRolesKey.Inactivity) return;

  await arm.call(this.client, CustomRolesKey.Inactivity, '', inactivitySweepSeconds);
  if (!this.plugin.isEnabled()) return;

  await this.sweep();
 };

 private serviceSince = async (now: number): Promise<number> => {
  const db = this.client.cache.cacheDb;
  const [beat, since] = await Promise.all([
   db.get(CustomRolesKey.WatchBeat),
   db.get(CustomRolesKey.WatchSince),
  ]);
  const state = watchWindow(Number(beat), Number(since), now, watchToleranceMs);

  if (state.reset) await db.set(CustomRolesKey.WatchSince, String(now));
  await db.set(CustomRolesKey.WatchBeat, String(now));

  return state.since;
 };

 sweep = async (): Promise<void> => {
  const now = Date.now();
  const serviceSince = await this.serviceSince(now);
  const enabled = await this.client.db.client.roleReward.findMany({
   where: { active: true, customRole: true, inactivityWipe: true },
   select: { guild: true },
  });

  for (const guildId of new Set(enabled.map((row) => row.guild))) {
   await this.sweepGuild(guildId, now, serviceSince).catch((error: Error) =>
    this.plugin.nonFatalError(error, 'customRoles.inactivitySweep'),
   );
  }
 };

 private signals = async (guildId: string): Promise<GuildSignals> => {
  const db = this.client.cache.cacheDb;
  const sources = Object.values(ActivitySource);
  const [observed, beat, since] = await Promise.all([
   Promise.all(sources.map((source) => db.get(`${CustomRolesKey.Observed}:${guildId}:${source}`))),
   db.get(`${CustomRolesKey.PresenceBeat}:${guildId}`),
   db.get(`${CustomRolesKey.PresenceSince}:${guildId}`),
  ]);

  return {
   observed: new Map(sources.map((source, index) => [source, Number(observed[index])])),
   presenceBeat: Number(beat),
   presenceSince: Number(since),
  };
 };

 private policyFor = (
  row: RoleReward,
  now: number,
  serviceSince: number,
  signals: GuildSignals,
 ): RewardPolicy => {
  const trackingSince = row.trackingSince?.getTime() ?? now;

  return {
   wipe: row.inactivityWipe,
   sources: row.activitySources,
   threshold: Number(row.inactiveAfter) * 1000,
   trackingSince,
   since: coverageStart({
    now,
    serviceSince,
    trackingSince,
    observedAt: Math.max(0, ...row.activitySources.map((s) => signals.observed.get(s) ?? 0)),
    // TODO: request presence intent for this
    // countsOnline: row.activitySources.includes(ActivitySource.Online),
    countsOnline: false,
    presenceBeat: signals.presenceBeat,
    presenceSince: signals.presenceSince,
    presenceTolerance: presenceToleranceMs,
   }),
  };
 };

 private activityOf = async (
  guildId: string,
  users: string[],
 ): Promise<Map<string, Map<string, number>>> => {
  const rows = await this.client.db.client.lastActive.findMany({
   where: { guild: guildId, user: { in: users } },
  });
  const byUser = new Map<string, Map<string, number>>();

  rows.forEach((row) => {
   const entry = byUser.get(row.user) ?? new Map<string, number>();
   entry.set(row.source, row.lastActive.getTime());
   byUser.set(row.user, entry);
  });

  return byUser;
 };

 private sweepGuild = async (guildId: string, now: number, serviceSince: number): Promise<void> => {
  const rows = await this.plugin.rewards.rowsFor(guildId);
  const unstamped = rows.filter((row) => row.inactivityWipe && !row.trackingSince);
  if (unstamped.length) {
   await this.client.db.client.roleReward.updateMany({
    where: { id: { in: unstamped.map((row) => row.id) } },
    data: { trackingSince: new Date(now) },
   });
  }

  const owners = (
   await this.client.db.client.customRole.findMany({
    where: { guild: guildId },
    select: { user: true },
   })
  ).map((row) => row.user);
  if (!owners.length) return;

  const signals = await this.signals(guildId);
  const policies = new Map(rows.map((row) => [row.id, this.policyFor(row, now, serviceSince, signals)]));
  const activity = await this.activityOf(guildId, owners);

  for (const user of owners) {
   const member = await this.client.cache.members.get(guildId, user);
   if (!member) continue;

   const applying = await this.plugin.rewards.resolveApplying(guildId, member.roles, user, rows);
   const granting = applying
    .filter((row) => row.customRole)
    .flatMap((row) => policies.get(row.id) ?? []);

   if (!shouldWipe(granting, activity.get(user) ?? new Map(), now)) continue;

   await this.plugin.roles.revoke(guildId, user, CustomRolesReason.Inactive);
  }
 };
}
