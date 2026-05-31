import { type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';

import type Client from '../../../../Classes/Client.js';
import type TicketPlugin from '../../Plugin.js';
import getTicketClassBySettingsType from '../../Util/getTicketClassBySettingsType.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (msg.author.bot) return;

 const ticket = await resolveTicket.call(this.client, msg);
 if (!ticket) return;

 await ticket.messageSent(this.client.cache.messages.apiToR(msg, msg.guild_id || '@me'));
}

const resolveTicket = async function (
 this: Client,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 const direct = await this.db.client.ticket.findFirst({
  where: { OR: [{ dm: msg.channel_id }, { channel: msg.channel_id }] },
  include: { settings: true },
 });
 if (direct) {
  return getTicketClassBySettingsType.call(this, direct.settings.type, String(direct.id));
 }

 const thread = await this.cache.threads.get(msg.channel_id);
 const ticketId = thread?.name.split('-')[1];
 if (!thread || !ticketId || !/^\d+$/.test(ticketId)) return null;

 const dbTicket = await this.db.client.ticket.findUnique({
  where: { id: ticketId },
  include: { settings: true },
 });
 if (!dbTicket || !dbTicket.settings.logChannels.includes(thread.parent_id ?? '')) return null;

 return getTicketClassBySettingsType.call(this, dbTicket.settings.type, String(dbTicket.id));
};
