import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import { matches } from '../../Classes/Providers.js';
import { origin } from '../../Classes/Routes.js';
import type BumpRemindersPlugin from '../../Plugin.js';

const replyDeleteDelayMs = 5000;

export default async function (
 this: BumpRemindersPlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (!data.guild_id || !data.author.bot) return;

 const candidates = await this.bumps.activeForBot(data.guild_id, data.author.id);
 const matched = candidates.filter((setting) => matches(setting, data));
 if (!matched.length) return;

 for (const setting of matched) {
  await this.bumps.bumped(setting, data.channel_id);
 }

 const api = await this.getAPI(data.guild_id);
 await api.channels.addMessageReaction(
  data.guild_id,
  data.channel_id,
  data.id,
  { main: '✅', alt: '✅' },
  { origin, reason: 'Bump registered' },
 );

 if (!matched.some((setting) => setting.deleteReply)) return;
 setTimeout(() => {
  void api.channels.deleteMessage(data.channel_id, data.id, {
   origin,
   reason: 'Bump confirmation cleanup',
  });
 }, replyDeleteDelayMs);
}
