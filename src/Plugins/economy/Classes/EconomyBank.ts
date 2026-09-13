import type { EconomyBalance, EconomySetting } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import { claimCooldown, dayEpoch } from '../../../Util/cooldown.js';
import { mintId } from '../../../Util/mintId.js';
import type EconomyPlugin from '../Plugin.js';

import { EconomyKey, SpendResult } from './Enums.js';

export interface EarnContext {
 guildId: string;
 userId: string;
 channelId: string;
 roleIds: string[];
 words: number;
}

export default class EconomyBank {
 plugin: EconomyPlugin;
 client: Client;

 constructor(plugin: EconomyPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 settings = async (guildId: string): Promise<EconomySetting> =>
  this.client.db.client.economySetting.upsert({
   where: { guild: guildId },
   create: { id: mintId(), guild: guildId },
   update: {},
  });

 row = async (guildId: string, userId: string): Promise<EconomyBalance> => {
  const settings = await this.settings(guildId);

  return this.client.db.client.economyBalance.upsert({
   where: { guild_user: { guild: guildId, user: userId } },
   create: { guild: guildId, user: userId, balance: settings.startBalance },
   update: {},
  });
 };

 balanceOf = async (guildId: string, userId: string): Promise<number> =>
  (await this.row(guildId, userId)).balance;

 private clamp = async (guildId: string, userId: string, max: number): Promise<void> => {
  if (max <= 0) return;

  await this.client.db.client.economyBalance.updateMany({
   where: { guild: guildId, user: userId, balance: { gt: max } },
   data: { balance: max },
  });
 };

 credit = async (guildId: string, userId: string, amount: number): Promise<number> => {
  if (amount <= 0) return this.balanceOf(guildId, userId);

  const settings = await this.settings(guildId);
  await this.row(guildId, userId);

  const updated = await this.client.db.client.economyBalance.update({
   where: { guild_user: { guild: guildId, user: userId } },
   data: { balance: { increment: amount } },
  });

  await this.clamp(guildId, userId, settings.maxBalance);

  return settings.maxBalance > 0 ? Math.min(updated.balance, settings.maxBalance) : updated.balance;
 };

 debit = async (guildId: string, userId: string, amount: number): Promise<boolean> => {
  if (amount <= 0) return true;
  await this.row(guildId, userId);

  const { count } = await this.client.db.client.economyBalance.updateMany({
   where: { guild: guildId, user: userId, balance: { gte: amount } },
   data: { balance: { decrement: amount } },
  });

  return count > 0;
 };

 setBalance = async (guildId: string, userId: string, amount: number): Promise<number> => {
  const settings = await this.settings(guildId);
  const target = Math.max(0, settings.maxBalance > 0 ? Math.min(amount, settings.maxBalance) : amount);

  const updated = await this.client.db.client.economyBalance.upsert({
   where: { guild_user: { guild: guildId, user: userId } },
   create: { guild: guildId, user: userId, balance: target },
   update: { balance: target },
  });

  return updated.balance;
 };

 top = async (guildId: string, take: number): Promise<EconomyBalance[]> =>
  this.client.db.client.economyBalance.findMany({
   where: { guild: guildId, balance: { gt: 0 } },
   orderBy: { balance: 'desc' },
   take,
  });

 rankOf = async (guildId: string, userId: string): Promise<number> => {
  const self = await this.row(guildId, userId);

  const ahead = await this.client.db.client.economyBalance.count({
   where: { guild: guildId, balance: { gt: self.balance } },
  });

  return ahead + 1;
 };

 private rollDay = async (guildId: string, userId: string, epoch: number): Promise<void> => {
  await this.client.db.client.economyBalance.updateMany({
   where: { guild: guildId, user: userId, earnedEpoch: { not: epoch } },
   data: { earnedEpoch: epoch, earnedToday: 0 },
  });
 };

 private capRemaining = (settings: EconomySetting, row: EconomyBalance, epoch: number): number => {
  if (settings.messageDailyCap <= 0) return settings.messageAmount;
  const spent = row.earnedEpoch === epoch ? row.earnedToday : 0;

  return Math.max(0, Math.min(settings.messageAmount, settings.messageDailyCap - spent));
 };

 earnFromMessage = async (ctx: EarnContext): Promise<number> => {
  const settings = await this.settings(ctx.guildId);
  if (!settings.active || settings.frozen || !settings.messageActive) return 0;

  const epoch = dayEpoch();
  const row = await this.row(ctx.guildId, ctx.userId);

  if (!this.withinTenure(settings, row)) return 0;

  const key = `${EconomyKey.EarnCooldown}:${ctx.guildId}:${ctx.userId}`;
  const seconds = Math.max(1, settings.messageCooldown);
  if (!(await claimCooldown(this.client.cache.cacheDb, key, seconds))) return 0;

  await this.rollDay(ctx.guildId, ctx.userId, epoch);

  const fresh = await this.row(ctx.guildId, ctx.userId);
  const amount = this.capRemaining(settings, fresh, epoch);
  if (amount <= 0) return 0;

  await this.client.db.client.economyBalance.update({
   where: { guild_user: { guild: ctx.guildId, user: ctx.userId } },
   data: { balance: { increment: amount }, earnedToday: { increment: amount }, earnedEpoch: epoch },
  });

  await this.clamp(ctx.guildId, ctx.userId, settings.maxBalance);

  return amount;
 };

 private withinTenure = (settings: EconomySetting, row: EconomyBalance): boolean => {
  if (settings.minTenureHours <= 0) return true;
  const elapsed = Date.now() - row.firstSeenAt.getTime();

  return elapsed >= settings.minTenureHours * 3_600_000;
 };

 transferAllowance = async (guildId: string, userId: string): Promise<number> => {
  const settings = await this.settings(guildId);
  if (settings.transferDailyMax <= 0) return Number.MAX_SAFE_INTEGER;

  const epoch = dayEpoch();
  const row = await this.row(guildId, userId);
  const spent = row.transferredEpoch === epoch ? row.transferredToday : 0;

  return Math.max(0, settings.transferDailyMax - spent);
 };

 noteTransfer = async (guildId: string, userId: string, amount: number): Promise<void> => {
  const epoch = dayEpoch();

  await this.client.db.client.economyBalance.updateMany({
   where: { guild: guildId, user: userId, transferredEpoch: { not: epoch } },
   data: { transferredEpoch: epoch, transferredToday: 0 },
  });

  await this.client.db.client.economyBalance.update({
   where: { guild_user: { guild: guildId, user: userId } },
   data: { transferredToday: { increment: amount }, transferredEpoch: epoch },
  });
 };

 awardPayout = async (
  guildId: string,
  userId: string,
  amount: number,
  key: string,
 ): Promise<SpendResult> => {
  const settings = await this.settings(guildId);
  if (!settings.active || settings.frozen) return SpendResult.Frozen;

  const payable = Math.max(0, Math.floor(amount));
  if (!payable) return SpendResult.Insufficient;

  try {
   await this.client.db.client.economyPayout.create({
    data: { key, guild: guildId, user: userId, amount: payable },
   });
  } catch {
   return SpendResult.AlreadyOwned;
  }

  await this.credit(guildId, userId, payable);

  return SpendResult.Ok;
 };
}
