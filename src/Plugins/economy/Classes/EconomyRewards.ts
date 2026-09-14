import type { EconomyRoleReward } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import { payoutFor } from '../../../Util/payoutCurve.js';
import { applyingRows, DigestAction, planDigest } from '../../../Util/roleRewards.js';
import { arm, isArmed, stripMarkerPrefix } from '../../../Util/schedule.js';
import type EconomyPlugin from '../Plugin.js';

import { LedgerReason, SpendResult } from './Enums.js';

export type EconomyRewardRow = EconomyRoleReward;

const dayMs = 86400000;
const duePageSize = 200;
const sweepSeconds = 900;
const sweepKey = 'economy:payouts';

export default class EconomyRewards {
 plugin: EconomyPlugin;
 client: Client;

 constructor(plugin: EconomyPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 private rowsFor = async (guildId: string): Promise<EconomyRewardRow[]> =>
  this.client.db.client.economyRoleReward.findMany({
   where: { guild: guildId, active: true },
  });

 private storedDigest = async (guildId: string, userId: string): Promise<string[] | null> => {
  const row = await this.client.db.client.economyRoleRewardEligibility.findUnique({
   where: { guild_user: { guild: guildId, user: userId } },
  });

  return row?.rewards ?? null;
 };

 private writeDigest = async (
  guildId: string,
  userId: string,
  rewards: string[],
 ): Promise<void> => {
  await this.client.db.client.economyRoleRewardEligibility.upsert({
   where: { guild_user: { guild: guildId, user: userId } },
   create: { guild: guildId, user: userId, rewards },
   update: { rewards },
  });
 };

 private payout = async (guildId: string, userId: string, row: EconomyRewardRow): Promise<void> => {
  const key = `${guildId}:${userId}:${row.id}`;
  const result = await this.plugin.bank.awardPayout(guildId, userId, row.currency, key);
  if (result !== SpendResult.Ok) return;

  await this.plugin.economyLog.record({
   guildId,
   userId,
   amount: row.currency,
   reason: LedgerReason.RoleReward,
  });
 };

 private startProgress = async (
  guildId: string,
  userId: string,
  rows: EconomyRewardRow[],
 ): Promise<void> => {
  if (!rows.length) return;

  const now = Date.now();

  await this.client.db.client.economyRoleRewardProgress.createMany({
   data: rows.map((row) => ({
    guild: guildId,
    user: userId,
    reward: row.id,
    nextPayoutAt: row.payEvery > 0 ? new Date(now + row.payEvery * dayMs) : null,
   })),
   skipDuplicates: true,
  });
 };

 private clearProgress = async (
  guildId: string,
  userId: string,
  rewardIds: string[],
 ): Promise<void> => {
  if (!rewardIds.length) return;

  await this.client.db.client.economyRoleRewardProgress.deleteMany({
   where: { guild: guildId, user: userId, reward: { in: rewardIds } },
  });
 };

 private stillHolds = async (
  guildId: string,
  userId: string,
  row: EconomyRewardRow,
 ): Promise<boolean> => {
  const member = await this.client.cache.members.get(guildId, userId);
  if (!member) return false;

  return applyingRows([row], member.roles ?? [], userId).length > 0;
 };

 private payRecurring = async (
  progress: { guild: string; user: string; reward: string; payouts: number },
  row: EconomyRewardRow,
 ): Promise<void> => {
  const step = progress.payouts + 1;
  const amount = payoutFor(row.recurringAmount, row.curve, row.curveModifier, step);
  const key = `${progress.guild}:${progress.user}:${row.id}:${step}`;

  if (amount > 0) {
   const result = await this.plugin.bank.awardPayout(progress.guild, progress.user, amount, key);

   if (result === SpendResult.Ok) {
    await this.plugin.economyLog.record({
     guildId: progress.guild,
     userId: progress.user,
     amount,
     reason: LedgerReason.RoleReward,
    });
   }
  }

  await this.client.db.client.economyRoleRewardProgress.updateMany({
   where: { guild: progress.guild, user: progress.user, reward: row.id },
   data: {
    payouts: step,
    nextPayoutAt: row.repeating ? new Date(Date.now() + row.payEvery * dayMs) : null,
   },
  });
 };

 runDuePayouts = async (): Promise<void> => {
  const due = await this.client.db.client.economyRoleRewardProgress.findMany({
   where: { nextPayoutAt: { lte: new Date() } },
   take: duePageSize,
  });
  if (!due.length) return;

  const rewards = await this.client.db.client.economyRoleReward.findMany({
   where: { id: { in: [...new Set(due.map((progress) => progress.reward))] } },
  });
  const byId = new Map(rewards.map((row) => [row.id, row as EconomyRewardRow]));

  for (const progress of due) {
   const row = byId.get(progress.reward);

   if (!row || !row.active || row.payEvery <= 0) {
    await this.clearProgress(progress.guild, progress.user, [progress.reward]);
    continue;
   }

   if (!(await this.stillHolds(progress.guild, progress.user, row))) {
    await this.clearProgress(progress.guild, progress.user, [progress.reward]);
    continue;
   }

   await this.payRecurring(progress, row);
  }
 };

 armSweep = async (): Promise<void> => {
  if (await isArmed.call(this.client, sweepKey)) return;

  await arm.call(this.client, sweepKey, '', sweepSeconds);
 };

 onScheduleExpired = async (rawKey: string): Promise<void> => {
  if (stripMarkerPrefix(rawKey) !== sweepKey) return;

  await arm.call(this.client, sweepKey, '', sweepSeconds);
  await this.runDuePayouts();
 };

 reconcileMember = async (
  guildId: string,
  userId: string,
  memberRoles: string[],
 ): Promise<void> => {
  const rows = await this.rowsFor(guildId);
  if (!rows.length) return;

  const applying = applyingRows(rows, memberRoles, userId);
  const plan = planDigest(applying, await this.storedDigest(guildId, userId));

  if (plan.write) await this.writeDigest(guildId, userId, plan.rewards);

  const starting =
   plan.action === DigestAction.Seed
    ? applying
    : applying.filter((row) => plan.gained.includes(row.id));

  await this.startProgress(guildId, userId, starting);
  await this.clearProgress(guildId, userId, plan.lost);

  const gained = applying.filter((row) => plan.gained.includes(row.id) && row.currency > 0);

  for (const row of gained) {
   await this.payout(guildId, userId, row);
  }
 };
}
