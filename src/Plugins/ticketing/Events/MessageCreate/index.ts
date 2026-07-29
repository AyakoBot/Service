import { MessageType, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type TicketPlugin from '../../Plugin.js';
import intakeGreet from '../../Util/intakeGreet.js';
import intakeInstantOpen from '../../Util/intakeInstantOpen.js';
import {
 resolveTicketByChannel,
 resolveTicketByDm,
 resolveTicketByLogThread,
 resolveTicketByStaffThread,
} from '../../Util/resolveTicket.js';

type MessageCreateData = ExtractPayload<GatewayDispatchEvents.MessageCreate>;
type MessageCreatePayload =
 | (MessageCreateData & { recipientId: string })
 | (MessageCreateData & { recipientId?: undefined });

export default async function (this: TicketPlugin, msg: MessageCreatePayload) {
 if (msg.author.bot) return;
 if (msg.type !== MessageType.Default && msg.type !== MessageType.Reply) return;

 const rMsg = this.client.cache.messages.apiToR(msg, msg.guild_id || '@me');

 let dmTicket = await resolveTicketByDm.call(this.client, msg.channel_id);

 if (!msg.guild_id && !dmTicket) {
  const opened = await intakeInstantOpen.call(this, msg.author.id, msg.channel_id, msg.recipientId);

  if (opened) {
   dmTicket = await resolveTicketByDm.call(this.client, msg.channel_id);
  } else {
   await intakeGreet.call(
    this,
    msg.author.id,
    msg.channel_id,
    msg.content || '',
    msg.attachments.map((attachment) => attachment.url),
    msg.recipientId,
   );
  }
 }

 if (dmTicket) {
  await dmTicket.messageSent(rMsg);
  await dmTicket.resetActivity();
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
