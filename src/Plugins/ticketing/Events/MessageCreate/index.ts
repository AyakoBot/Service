import {
 TicketState,
 TicketType,
 type Ticket as PrismaTicket,
 type TicketSetting as PrismaTicketSetting,
} from '@ayako/database';
import type { RChannel, RThread } from '@ayako/utility';
import { ChannelType, MessageType, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';

import type TicketPlugin from '../../Plugin.js';
import DBTicket from '../../DBTicket.js';

import { type handleTicketDelete } from '../MessageDelete/index.js';

import ChannelToDm from './ChannelToDm.js';
import dmToChannel from './DmToChannel.js';
import LogThreadToChannelAndDm from './LogThreadToChannelAndDm.js';

type HandleFunction = typeof handleTicket | handleTicketDelete;

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<
  | GatewayDispatchEvents.MessageCreate
  | GatewayDispatchEvents.MessageUpdate
  | GatewayDispatchEvents.MessageDelete
 >,
 handleFunction: HandleFunction = handleTicket,
) {
 const mCU = msg as ExtractPayload<
  GatewayDispatchEvents.MessageCreate | GatewayDispatchEvents.MessageUpdate
 >;

 if ('author' in msg && mCU.author.bot) return;
 if ('webhook_id' in msg && mCU.webhook_id) return;
 if ('type' in msg && ![MessageType.Default, MessageType.Reply].includes(mCU.type)) return;

 if (!msg.guild_id) {
  const ticket = await DBTicket.findUniqueWithInclude(this.client, {
   where: { dm: msg.channel_id },
   include: { settings: true },
  });
  if (!ticket || !isTicketActive(ticket?.settings)) return;

  handleFunction.call(this, msg as never, ticket, true);
  return;
 }

 const channel =
  (await this.client.cache.channels.get(msg.channel_id)) ||
  (await this.client.cache.threads.get(msg.channel_id));
 if (!channel) return;

 if (
  [ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(
   channel.type,
  ) &&
  channel.name.startsWith('log-')
 ) {
  const ticket = await new DBTicket(this.client, channel.name.split('-').at(1) || '').getWithInclude({
   settings: true,
  });
  if (!ticket || !isTicketActive(ticket?.settings)) return;

  handleFunction.call(this, msg as never, ticket, channel);
  return;
 }

 const ticket = await DBTicket.findUniqueWithInclude(this.client, {
  where: { channel: msg.channel_id },
  include: { settings: true },
 });
 if (!ticket || !isTicketActive(ticket?.settings)) return;

 handleFunction.call(this, msg as never, ticket, channel);
}

export const isTicketActive = (settings: PrismaTicketSetting) =>
 !!settings && settings.active && !!settings.channel;

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
   if (typeof dmOrChannel === 'boolean') dmToChannel.call(this, msg, ticket);
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

// Cases
/**
 * dmToChannel
 * ✅ Channel to direct message
 * ✅ Direct message to channel
 * logThreadLog
 *
 * dmToThread
 * Thread to direct message
 * Direct message to thread
 * Thread private
 * Log
 *
 * Channel
 * Log to Channel
 * Log
 *
 * Thread
 * Log to Thread
 * Log
 */
