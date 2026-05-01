import { TicketState } from '@ayako/database';
import { EmbedBuilder } from '@discordjs/builders';
import { ChannelType, type APIMessageComponentInteraction } from 'discord.js';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import emotes from '../../../../Classes/Emotes.js';
import { Colors } from '../../../../Types/index.js';
import showCommandError from '../../../../Util/showCommandError.js';

import type TicketPlugin from '../../Plugin.js';
import Ticket from '../../Ticket.js';

import { handleLog, LogType } from './util.js';
import { RequestHandlerError } from '@ayako/api';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.channel) return;

 const { user } = cmd;
 if (!user) return;

 const ticketId = args.shift();
 if (!ticketId) return;

 const ticket = await new Ticket(this.client, ticketId).getWithInclude({ settings: true });
 const t = await this.t(ticket?.settings.guild || cmd.locale);

 if (!ticket) {
  showCommandError.call(this.client, t.notFound(), cmd, t.base, false);
  return;
 }

 const api = await this.client.getAPI(ticket.settings.guild);

 if (!cmd.message.embeds.length) {
  const message = await api.interactions.deferMessageUpdate(
   cmd.id,
   cmd.token,
   { with_response: true },
   { origin: this.name, reason: 'Deferring leave confirmation' },
  );

  if (!message || message instanceof RequestHandlerError) return;

  const msgId = message.interaction.response_message_id || message.resource?.message?.id;
  if (!msgId) return;

  await api.channels.editDirectMessage(
   cmd.channel.id,
   msgId,
   { embeds: [new EmbedBuilder().setDescription(t.leaveSure()).toJSON()] },
   { origin: this.name, reason: 'Confirming ticket leave' },
  );
  return;
 }

 new Ticket(this.client, ticketId).update({ state: TicketState.closed }).then();

 new MessagePayload(this.client, { origin: this.name, reason: 'User left ticket' })
  .setEmbeds([
   new EmbedBuilder()
    .setAuthor({
     name: user.username,
     iconURL: this.client.cache.users.apiToR(user).avatar_url || '',
    })
    .setColor(Colors.Danger)
    .setDescription(
     `${constants.formatters.getEmote(emotes.crossWithBackground)}: ${t.leftTicket()}`,
    ),
  ])
  .setSendTo([{ channel: cmd.channel.id, guildId: ticket.settings.guild }])
  .send();

 handleLog.call(this, ticketId, {
  type: LogType.TicketLeft,
  data: { user },
 });

 if (cmd.channel.type === ChannelType.DM) {
  api.channels.unpinDirectMessage(cmd.channel.id, cmd.message.id, {
   origin: this.name,
   reason: 'Unpinning leave confirmation message',
  });
 } else {
  api.channels.unpinMessage(cmd.channel.id, cmd.message.id, {
   origin: this.name,
   reason: 'Unpinning leave confirmation message',
  });
 }

 api.interactions.updateMessage(
  cmd.id,
  cmd.token,
  { content: t.ticketLeft(), components: [], embeds: [] },
  { origin: this.name, reason: 'Finalizing ticket leave' },
 );
}
