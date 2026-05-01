import type { Ticket, TicketSetting } from '@ayako/database';
import type { GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';

import { shouldForward } from '../MessageCreate/LogThreadToChannelAndDm.js';

import type TicketPlugin from '../../Plugin.js';

import ChannelToDm from './ChannelToDm.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageUpdate>,
 ticket: Ticket & { settings: TicketSetting },
) {
 const forwardable = await shouldForward.call(this, msg, ticket);
 if (!forwardable) return;

 ChannelToDm.call(this, msg, ticket);
}
