import type { Ticket, TicketSetting } from '@ayako/database';
import { ContainerBuilder } from '@discordjs/builders';
import { MessageFlags, type GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../../Types/gateway.js';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';

import constants from '../../../../Classes/Constants.js';
import emotes from '../../../../Classes/Emotes.js';
import { cloneMessageIntoContainer } from '../InteractionCreate/util.js';

import { RequestHandlerError } from '@ayako/api';
import type TicketPlugin from '../../Plugin.js';

export default async function (
 this: TicketPlugin,
 msg: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
 ticket: Ticket & { settings: TicketSetting },
) {
 if (msg.guild_id) return;

 const forwardContainer = new ContainerBuilder();

 const rMsg = this.client.cache.messages.apiToR(msg, msg.guild_id || '@me');
 cloneMessageIntoContainer.call(forwardContainer, rMsg, {
  authorName: `<@${msg.author.id}> / \`${msg.author.id}\``,
  context: `${msg.id}`,
 });

 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Forwarding message from user DM to ticket channel',
 })
  .addComponents(forwardContainer.toJSON())
  .setFlags(MessageFlags.IsComponentsV2);

 const api = await this.client.getAPI(ticket.settings.guild);

 const [message] = await payload
  .setSendTo([{ channel: ticket.channel, guildId: ticket.settings.guild }])
  .send();

 api.channels.addDirectMessageReaction(
  msg.channel_id,
  msg.id,
  message instanceof RequestHandlerError
   ? constants.formatters.getEmoteIdentifier(emotes.crossWithBackground) || '❌'
   : constants.formatters.getEmoteIdentifier(emotes.tickWithBackground) || '✅',
  {
   origin: this.name,
   reason: `Adding reaction to message in dm channel after forwarding to ticket channel ${message instanceof RequestHandlerError ? 'failed' : ''}`,
  },
 );
}
