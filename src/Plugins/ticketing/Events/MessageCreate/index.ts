import { ChannelType, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type TicketPlugin from '../../Plugin.js';
import getTicketClassBySettingsType from '../../Util/getTicketClassBySettingsType.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (msg.author.bot) return;

 dm.call(this, msg);
 channel.call(this, msg);
 log.call(this, msg);
}

const dm = async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 const dbTicket = await this.client.db.client.ticket.findFirst({
  where: { dm: msg.channel_id },
  include: { settings: true },
 });
 if (!dbTicket) return;

 const ticket = getTicketClassBySettingsType.call(
  this.client,
  dbTicket.settings.type,
  String(dbTicket.id),
 );
 if (!ticket) return;

 await ticket.messageSent(this.client.cache.messages.apiToR(msg, msg.guild_id || '@me'));
};

const channel = async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 const dbTicket = await this.client.db.client.ticket.findFirst({
  where: { channel: msg.channel_id },
  include: { settings: true },
 });
 if (!dbTicket) return;

 const ticket = getTicketClassBySettingsType.call(
  this.client,
  dbTicket.settings.type,
  String(dbTicket.id),
 );
 if (!ticket) return;

 await ticket.messageSent(this.client.cache.messages.apiToR(msg, msg.guild_id || '@me'));
};

const log = async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 const threadOrChannel =
  (await this.client.cache.channels.get(msg.channel_id)) ||
  (await this.client.cache.threads.get(msg.channel_id));
 if (!threadOrChannel) return;

 const isThread = [
  ChannelType.AnnouncementThread,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
 ].includes(threadOrChannel.type);

 if (!isThread) return;

 const [, ticketId] = threadOrChannel.name.split('-');
 if (!ticketId) return;

 const dbTicket = await this.client.db.client.ticket.findUnique({
  where: { id: ticketId },
  include: { settings: true },
 });
 if (!dbTicket) return;

 const ticket = getTicketClassBySettingsType.call(
  this.client,
  dbTicket.settings.type,
  String(dbTicket.id),
 );
 if (!ticket) return;

 ticket.messageSent(this.client.cache.messages.apiToR(msg, msg.guild_id || '@me'));
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
