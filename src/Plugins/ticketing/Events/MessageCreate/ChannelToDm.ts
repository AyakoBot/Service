import { RequestHandlerError } from '@ayako/api';
import type { Ticket, TicketSetting } from '@ayako/database';
import { ContainerBuilder } from '@discordjs/builders';
import { MessageFlags, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import getErrorMessagePayload from '../../../../Util/getErrorMessagePayload.js';

import constants from '../../../../Classes/Constants.js';
import emotes from '../../../../Classes/Emotes.js';
import { cloneMessageIntoContainer, LogType } from '../InteractionCreate/util.js';

import type TicketPlugin from '../../Plugin.js';
import { doReaction, prepareLog, removeSendMessagePrefixes } from '../MessageUpdate/util.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
 ticket: Ticket & { settings: TicketSetting },
) {
 if (!msg.guild_id) return;
 const t = await this.t(ticket.settings.guild);

 if (!ticket.dm) {
  getErrorMessagePayload
   .call(this.client, t.base, t.couldntDm(), {
    origin: this.name,
    reason: 'Property "dm" was not found on ticket - create failed',
   })
   .setReply(msg.id)
   .setSendTo([{ channel: msg.channel_id, guildId: ticket.settings.guild }])
   .send();

  return;
 }

 if (
  !ticket.settings.sendMessagePrefixes.length ||
  !ticket.settings.sendMessagePrefixes.every((prefix) => msg.content.startsWith(prefix))
 ) {
  return;
 }

 const forwardContainer = new ContainerBuilder();

 msg.content = removeSendMessagePrefixes(msg.content, ticket.settings.sendMessagePrefixes);

 const rMsg = this.client.cache.messages.apiToR(msg, msg.guild_id || '@me');
 cloneMessageIntoContainer.call(forwardContainer, rMsg, {
  authorName: `${emotes.tools.name} | ${t.SupportTeam()}`,
  context: msg.id,
 });

 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Forwarding message from ticket channel to user DM',
 })
  .addComponents(forwardContainer.toJSON())
  .setFlags(MessageFlags.IsComponentsV2);

 const api = await this.client.getAPI(ticket.settings.guild);

 const dm = await api.channels.createDirectMessage(ticket.dm, payload.getAPIPayload(), {
  origin: this.name,
  reason: payload.reason,
 });

 if (dm instanceof RequestHandlerError) {
  getErrorMessagePayload
   .call(this.client, t.base, t.couldntSendDm(), {
    origin: this.name,
    reason: 'Could not send message in user DM',
   })
   .setReply(msg.id)
   .setSendTo([{ channel: msg.channel_id, guildId: ticket.settings.guild }])
   .send();

  return;
 }
 prepareLog.call(this, msg, ticket, LogType.MessageSent);

 doReaction.call(
  api,
  ticket,
  { dm: false, id: msg.channel_id },
  msg.id,
  { main: constants.formatters.getEmoteIdentifier(emotes.tickWithBackground), alt: '✅' },
  {
   origin: this.name,
   reason: 'Adding/removing reaction to message in ticket channel after forwarding to user DM',
  },
 );
}
