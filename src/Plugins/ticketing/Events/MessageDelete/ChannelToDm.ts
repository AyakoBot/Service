import { RequestHandlerError } from '@ayako/api';
import type { Ticket, TicketSetting } from '@ayako/database';
import { type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';
import getErrorMessagePayload from '../../../../Util/getErrorMessagePayload.js';

import type TicketPlugin from '../../Plugin.js';

import { LogType } from '../InteractionCreate/util.js';
import { getTicketDirectMessageFromId, prepareLog } from '../MessageUpdate/util.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageDelete>,
 ticket: Ticket & { settings: TicketSetting },
) {
 if (!msg.guild_id) return;
 const t = await this.t(ticket.settings.guild);

 if (!ticket.dm) {
  getErrorMessagePayload
   .call(this.client, t.base, t.couldntDm(), {
    origin: this.name,
    reason: 'Property "dm" was not found on ticket',
   })
   .setReply(msg.id)
   .setSendTo([{ channel: msg.channel_id, guildId: ticket.settings.guild }])
   .send();

  return;
 }

 deleteDm.call(this, msg, ticket);
}

const deleteDm = async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageDelete>,
 ticket: Ticket & { settings: TicketSetting },
) {
 if (!ticket.dm) return;

 const t = await this.t(ticket.settings.guild);
 const deleteMsg = await getTicketDirectMessageFromId.call(this, ticket, msg.id);

 if (!deleteMsg) return;

 const api = await this.client.getAPI(ticket.settings.guild);
 const del = await api.channels.deleteDirectMessage(ticket.dm, deleteMsg.id, {
  origin: this.name,
  reason: 'Deleting forwarded message from ticket channel to user DM',
 });

 if (del instanceof RequestHandlerError) {
  getErrorMessagePayload
   .call(this.client, t.base, t.couldntDeleteDm(), {
    origin: this.name,
    reason: 'Could not delete message in user DM',
   })
   .setReply(msg.id)
   .setSendTo([{ channel: msg.channel_id, guildId: ticket.settings.guild }])
   .send();

  return;
 }
 prepareLog.call(this, msg, ticket, LogType.MessageDeleted);
};
