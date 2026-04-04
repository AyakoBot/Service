import { type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type TicketPlugin from '../../Plugin.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {


}
