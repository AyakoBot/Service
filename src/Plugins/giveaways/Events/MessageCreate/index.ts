import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type GiveawaysPlugin from '../../Plugin.js';

export default function (
 this: GiveawaysPlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (data.author.bot || !data.guild_id) return;

 this.activity
  .onMessage(data.guild_id, data.author.id, data.channel_id)
  .catch((e: Error) => this.nonFatalError(e, 'activityMessage'));
}
