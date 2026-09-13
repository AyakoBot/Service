import type Client from '../../../Classes/Client.js';
import { applyingRows, planDigest, type RewardTrigger } from '../../../Util/roleRewards.js';
import type EconomyPlugin from '../Plugin.js';

import { LedgerReason, SpendResult } from './Enums.js';

export interface EconomyRewardRow extends RewardTrigger {
 currency: number;
}

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

  const gained = applying.filter((row) => plan.gained.includes(row.id) && row.currency > 0);

  for (const row of gained) {
   await this.payout(guildId, userId, row);
  }
 };
}
