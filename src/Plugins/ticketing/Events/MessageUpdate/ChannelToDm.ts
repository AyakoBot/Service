import { RequestHandlerError } from '@ayako/api';
import type { Ticket, TicketSetting } from '@ayako/database';
import type { RMessage } from '@ayako/utility';
import { ContainerBuilder } from '@discordjs/builders';
import { ComponentType, MessageFlags, type GatewayDispatchEvents } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import emotes from '../../../../Classes/Emotes.js';
import type { ExtractPayload } from '../../../../Types/gateway.js';
import getErrorMessagePayload from '../../../../Util/getErrorMessagePayload.js';

import type TicketPlugin from '../../Plugin.js';

import { cloneMessageIntoContainer, LogType } from '../InteractionCreate/util.js';

import {
 doReaction,
 getTicketDirectMessageFromId,
 prepareLog,
 removeSendMessagePrefixes,
} from './util.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageUpdate>,
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

 const oldMessageTimes = await this.client.cache.messages.getTimes(msg.id);
 const newestMessageTime = Object.values(oldMessageTimes).sort((a, b) => b - a)[1];
 const newestMessage = await this.client.cache.messages.getAt(newestMessageTime, msg.id);

 if (!newestMessage) {
  const dm = await getTicketDirectMessageFromId.call(this, ticket, msg.id);
  if (!dm) {
   getErrorMessagePayload
    .call(this.client, t.base, t.couldntDm(), {
     origin: this.name,
     reason: 'Could not find message to update in user DM',
    })
    .setReply(msg.id)
    .setSendTo([{ channel: msg.channel_id, guildId: ticket.settings.guild }])
    .send();
   return;
  }

  const [textComponent] =
   dm.components
    ?.find((c) => c.type === ComponentType.Container)
    ?.components.filter((t) => t.type === ComponentType.TextDisplay) || [];

  routeUpdateDm.call(this, msg, { content: textComponent?.content || null }, ticket);
  return;
 }

 routeUpdateDm.call(this, msg, newestMessage, ticket);
}

const routeUpdateDm = async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageUpdate>,
 newestMessage: RMessage | { content: string | null },
 ticket: Ticket & { settings: TicketSetting },
) {
 const t = await this.t(ticket.settings.guild);

 if (!ticket.dm) {
  getErrorMessagePayload
   .call(this.client, t.base, t.couldntDm(), {
    origin: this.name,
    reason: 'Property "dm" was not found on ticket - update failed',
   })
   .setReply(msg.id)
   .setSendTo([{ channel: msg.channel_id, guildId: ticket.settings.guild }])
   .send();

  return;
 }

 if (!ticket.settings.sendMessagePrefixes.length) {
  updateDm.call(this, msg, ticket);
  return;
 }

 const newMsgHasPrefix = ticket.settings.sendMessagePrefixes.some((prefix) =>
  msg.content?.startsWith(prefix),
 );
 const oldMsgHadPrefix = ticket.settings.sendMessagePrefixes.some((prefix) =>
  newestMessage.content?.startsWith(prefix),
 );

 if (newMsgHasPrefix && !oldMsgHadPrefix) return;

 if (!newMsgHasPrefix) {
  deleteDm.call(this, msg, ticket);
  return;
 }

 updateDm.call(this, msg, ticket);
};

const updateDm = async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageUpdate>,
 ticket: Ticket & { settings: TicketSetting },
) {
 if (!ticket.dm) return;

 const t = await this.t(ticket.settings.guild);
 const updateMsg = await getTicketDirectMessageFromId.call(this, ticket, msg.id);

 if (!updateMsg) {
  getErrorMessagePayload
   .call(this.client, t.base, t.couldntDm(), {
    origin: this.name,
    reason: 'Could not find message to update in user DM',
   })
   .setReply(msg.id)
   .setSendTo([{ channel: msg.channel_id, guildId: ticket.settings.guild }])
   .send();

  return;
 }

 msg.content = removeSendMessagePrefixes(msg.content, ticket.settings.sendMessagePrefixes);

 const forwardContainer = new ContainerBuilder();
 cloneMessageIntoContainer.call(
  forwardContainer,
  this.client.cache.messages.apiToR(msg, ticket.settings.guild),
  { authorName: `${emotes.tools.name} | ${t.SupportTeam()}`, context: msg.id },
 );

 const m = await new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Editing forwarded message from ticket channel to user DM',
 })
  .addComponents(forwardContainer.toJSON())
  .setFlags(MessageFlags.IsComponentsV2)
  .editDM(ticket.dm, updateMsg.id);

 if (m instanceof RequestHandlerError) {
  getErrorMessagePayload
   .call(this.client, t.base, t.couldntEditDm(), {
    origin: this.name,
    reason: 'Could not edit message in user DM',
   })
   .setReply(msg.id)
   .setSendTo([{ channel: msg.channel_id, guildId: ticket.settings.guild }])
   .send();

  return;
 }

 prepareLog.call(this, msg, ticket, LogType.MessageEdited);

 const api = await this.client.getAPI(ticket.settings.guild);
 doReaction.call(
  api,
  ticket,
  { dm: false, id: msg.channel_id },
  msg.id,
  { main: constants.formatters.getEmoteIdentifier(emotes.edit), alt: '✏️' },
  {
   origin: this.name,
   reason: 'Adding reaction to message in ticket channel after editing message in user DM',
  },
 );
};

const deleteDm = async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageUpdate>,
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

 doReaction.call(
  api,
  ticket,
  { dm: false, id: msg.channel_id },
  msg.id,
  { main: constants.formatters.getEmoteIdentifier(emotes.trash), alt: '🗑️' },
  {
   origin: this.name,
   reason:
    'Adding/removing reaction to message in ticket channel after deleting message in user DM',
  },
 );
};
