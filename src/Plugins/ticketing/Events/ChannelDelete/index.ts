import { type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type TicketPlugin from '../../Plugin.js';
import onTicketChannelDeleted from '../../Util/onTicketChannelDeleted.js';

export default async function (
 this: TicketPlugin,
 channel: ExtractPayload<GatewayDispatchEvents.ChannelDelete>,
) {
 await onTicketChannelDeleted.call(this, channel.id);
}
