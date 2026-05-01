import {
 TicketState,
 TicketType,
 type Ticket as PrismaTicket,
 type TicketSetting as PrismaTicketSetting,
} from '@ayako/database';
import type { RChannel, RThread } from '@ayako/utility';
import { type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';

import type TicketPlugin from '../../Plugin.js';

import MessageCreate from '../MessageCreate/index.js';
import ChannelToDm from './ChannelToDm.js';
import LogThreadToChannelAndDm from './LogThreadToChannelAndDm.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageUpdate>,
) {
 MessageCreate.call(this, msg, handleTicket);
}

const handleTicket = async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
 ticket: PrismaTicket & { settings: PrismaTicketSetting },
 dmOrChannel: true | RChannel | RThread,
) {
 if (ticket.state === TicketState.closed) return;

 switch (ticket.settings.type) {
  case TicketType.Channel: {
   break;
  }

  case TicketType.Thread: {
   break;
  }

  case TicketType.dmToChannel: {
   if (typeof dmOrChannel !== 'boolean') {
    ChannelToDm.call(this, msg, ticket);
    LogThreadToChannelAndDm.call(this, msg, ticket);
   }
   // if (typeof dmOrChannel === 'boolean') dmToChannel.call(this, msg, ticket);
   break;
  }

  case TicketType.dmToThread: {
   break;
  }

  default:
   this.client.logger.warn(
    `[Plugin:${this.name}] No handler for ticket type: ${ticket.settings.type}`,
   );
   break;
 }

 return;
};
