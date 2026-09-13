import type Client from '../../../Classes/Client.js';
import type CustomRolesPlugin from '../Plugin.js';

export interface PayoutSink {
 award: (guildId: string, userId: string, amount: number, key: string) => Promise<void>;
}

export const payoutKey = (guildId: string, userId: string, rewardRowId: string): string =>
 `${guildId}:${userId}:${rewardRowId}`;

export default class RewardPayouts {
 plugin: CustomRolesPlugin;
 client: Client;

 private sink: PayoutSink | null = null;

 constructor(plugin: CustomRolesPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 registerSink = (sink: PayoutSink): void => {
  this.sink = sink;
 };

 hasSink = (): boolean => !!this.sink;

 award = async (
  guildId: string,
  userId: string,
  amount: number,
  rewardRowId: string,
 ): Promise<void> => {
  const key = payoutKey(guildId, userId, rewardRowId);

  if (!this.sink) {
   this.plugin.logger.debug(`[CustomRoles] no payout sink; dropping ${amount} for ${key}`);
   return;
  }

  await this.sink.award(guildId, userId, amount, key);
 };
}
