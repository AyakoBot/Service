import type { GatewayDispatchEvents } from 'discord-api-types/v10';

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
 msg: ExtractPayload<GatewayDispatchEvents.MessageUpdate>,
) {
 if (msg.author?.bot) return;

 const rMsg = this.client.cache.messages.apiToR(msg, msg.guild_id || '@me');

 const staffTicket = await resolveTicketByStaffThread.call(this.client, msg.channel_id);
 if (staffTicket) {
  staffTicket.messageEdited(rMsg, true);
  return;
 }

 const ticket =
  (await resolveTicketByDm.call(this.client, msg.channel_id)) ||
  (await resolveTicketByChannel.call(this.client, msg.channel_id)) ||
  (await resolveTicketByLogThread.call(this.client, msg.channel_id));
 if (!ticket) return;

 await ticket.propagateEdit(rMsg);
}
