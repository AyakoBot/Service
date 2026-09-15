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
 if (!earnableTypes.includes(data.type)) return;
 if (data.author.bot || data.webhook_id) return;

 const settings = await this.bank.settings(data.guild_id);
 if (!settings.active || settings.frozen || settings.messageAmount <= 0) return;

 const channelId = await parentOf.call(this.client, data.channel_id);
 const roleIds = data.member?.roles ?? [];

 if (
  isBlocked(settings, { channelId, userId: data.author.id, roleIds }) ||
  isBlocked(settings, { channelId: data.channel_id, userId: data.author.id, roleIds })
 ) {
  return;
 }

 const amount = await this.bank.earnFromMessage({
  guildId: data.guild_id,
  userId: data.author.id,
  channelId,
  roleIds,
  words: wordsIn(data.content || ''),
 });

 if (!amount) return;

 await this.economyLog.record({
  guildId: data.guild_id,
  userId: data.author.id,
  amount,
  reason: LedgerReason.Message,
 });
}
