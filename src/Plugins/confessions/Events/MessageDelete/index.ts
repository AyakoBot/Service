import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type ConfessionsPlugin from '../../Plugin.js';

export default async function (
 this: ConfessionsPlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageDelete>,
): Promise<void> {
 if (!data.guild_id) return;

 await this.confessions.removeByMessages(data.guild_id, [data.id]);
}
