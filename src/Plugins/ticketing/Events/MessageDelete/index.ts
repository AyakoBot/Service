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
 msg: ExtractPayload<GatewayDispatchEvents.MessageDelete>,
) {
 const staffTicket = await resolveTicketByStaffThread.call(this.client, msg.channel_id);
 if (staffTicket) {
  const staffSettings = (await staffTicket.getTicket()).settings;
  const api = await this.getAPI(staffSettings.guild, staffSettings.botToken);
  const times = await this.client.cache.messages.getTimes(msg.id);
  const cached = times.length
   ? await this.client.cache.messages.getAt(Math.max(...times), msg.id)
   : null;
  if (cached?.author_id === api.botId) return;

  staffTicket.messageDeleted(cached, true);
  return;
 }

 const ticket =
  (await resolveTicketByDm.call(this.client, msg.channel_id)) ||
  (await resolveTicketByChannel.call(this.client, msg.channel_id)) ||
  (await resolveTicketByLogThread.call(this.client, msg.channel_id));
 if (!ticket) return;

 await ticket.propagateDelete(msg.id);
}
