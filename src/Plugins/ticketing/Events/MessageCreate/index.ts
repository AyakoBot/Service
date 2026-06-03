import { MessageType, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import type TicketPlugin from '../../Plugin.js';
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
 if (dmTicket) await dmTicket.messageSent(rMsg);

 const channelTicket = await resolveTicketByChannel.call(this.client, msg.channel_id);
 if (channelTicket) await channelTicket.messageSent(rMsg);

 const logTicket = await resolveTicketByLogThread.call(this.client, msg.channel_id);
 if (logTicket) logTicket.messageSent(rMsg, true);

 const staffTicket = await resolveTicketByStaffThread.call(this.client, msg.channel_id);
 if (staffTicket) staffTicket.messageSent(rMsg, true);
}
