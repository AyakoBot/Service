import type { GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type EconomyPlugin from '../../Plugin.js';

export default async function (
 this: EconomyPlugin,
 data: ExtractPayload<GatewayDispatchEvents.MessageDelete>,
) {
 if (!data.guild_id) return;

 await this.client.db.client.economyItem.updateMany({
  where: { guild: data.guild_id, message: data.id },
  data: { message: null, channel: null, active: false },
 });
}
