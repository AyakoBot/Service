import { MessageType, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type Client from '../../../../Classes/Client.js';
import { isBlocked } from '../../../../Util/accessLists.js';
import type { ExtractPayload } from '../../../../Types/gateway.js';
import { LedgerReason } from '../../Classes/Enums.js';
import type EconomyPlugin from '../../Plugin.js';

const earnableTypes = [MessageType.Default, MessageType.Reply];

const parentOf = async function (this: Client, channelId: string): Promise<string> {
 const thread = await this.cache.threads.get(channelId);

 return thread?.parent_id || channelId;
};

const wordsIn = (content: string): number => content.split(/\s+/).filter(Boolean).length;

export default async function (
 this: EconomyPlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (!data.guild_id) return;
 if (!earnableTypes.includes(data.type)) {
  this.logger.silly(`[earn] skipped: message type ${data.type} is not earnable`);
  return;
 }
 if (data.author.bot || data.webhook_id) return;

 const settings = await this.bank.settings(data.guild_id);
 if (!settings.active || settings.frozen || settings.messageAmount <= 0) {
  this.logger.silly(
   `[earn] blocked by settings: active=${settings.active} frozen=${settings.frozen} messageAmount=${settings.messageAmount}`,
  );
  return;
 }

 const channelId = await parentOf.call(this.client, data.channel_id);
 const roleIds = data.member?.roles ?? [];

 if (
  isBlocked(settings, { channelId, userId: data.author.id, roleIds }) ||
  isBlocked(settings, { channelId: data.channel_id, userId: data.author.id, roleIds })
 ) {
  this.logger.silly(
   `[earn] blocked by access lists in ${data.channel_id}: allow=${settings.allowChannels.length}/${settings.allowRoles.length}/${settings.allowUsers.length} deny=${settings.denyChannels.length}/${settings.denyRoles.length}/${settings.denyUsers.length}`,
  );
  return;
 }

 this.logger.silly(`[earn] passed all gates for ${data.author.id}, asking the bank`);

 const amount = await this.bank.earnFromMessage({
  guildId: data.guild_id,
  userId: data.author.id,
  channelId,
  roleIds,
  words: wordsIn(data.content || ''),
 });

 if (!amount) {
  this.logger.silly('[earn] bank returned 0 (cooldown, daily cap or tenure)');
  return;
 }

 this.logger.silly(`[earn] credited ${amount} to ${data.author.id}`);

 await this.economyLog.record({
  guildId: data.guild_id,
  userId: data.author.id,
  amount,
  reason: LedgerReason.Message,
 });
}
