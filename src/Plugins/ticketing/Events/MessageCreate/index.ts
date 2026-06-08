import { MessageType, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type TicketPlugin from '../../Plugin.js';
import intakeGreet from '../../Util/intakeGreet.js';
import {
 resolveTicketByChannel,
 resolveTicketByDm,
 resolveTicketByLogThread,
 resolveTicketByStaffThread,
} from '../../Util/resolveTicket.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
) {
 if (msg.author.bot) return;
 if (msg.type !== MessageType.Default && msg.type !== MessageType.Reply) return;

 const rMsg = this.client.cache.messages.apiToR(msg, msg.guild_id || '@me');

 const dmTicket = await resolveTicketByDm.call(this.client, msg.channel_id);
 if (dmTicket) {
  await dmTicket.messageSent(rMsg);
  await dmTicket.resetActivity();
 }

 if (!msg.guild_id && !dmTicket) {
  await intakeGreet.call(this, msg.author.id, msg.channel_id, msg.content || '');
 }

 const channelTicket = await resolveTicketByChannel.call(this.client, msg.channel_id);
 if (channelTicket) {
  await channelTicket.messageSent(rMsg);
  await channelTicket.resetActivity();
 }

 const logTicket = await resolveTicketByLogThread.call(this.client, msg.channel_id);
 if (logTicket) {
  await logTicket.staffReply(rMsg);
  await logTicket.resetActivity();
 }

 const staffTicket = await resolveTicketByStaffThread.call(this.client, msg.channel_id);
 if (staffTicket) {
  staffTicket.messageSent(rMsg, true);
  await staffTicket.resetActivity();
 }
}
