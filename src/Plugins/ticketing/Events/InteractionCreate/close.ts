import { RequestHandlerError } from '@ayako/api';
import { LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import { TextInputStyle, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { TicketRoute } from '../../Classes/Routes.js';
import type TicketPlugin from '../../Plugin.js';
import getTicketClassById from '../../Util/getTicketClassById.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(TicketRoute.CloseReason, args[0]))
  .setTitle(t.closeModalTitle())
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.closeReasonLabel())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId('reason')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false),
    ),
  );

 const ticket = await getTicketClassById.call(this.client, args[0]).catch(() => null);
 const overrideCipher = ticket ? (await ticket.getTicket()).settings.botToken : null;

 const api = await this.getAPI(cmd.guild_id, overrideCipher);
 const res = await api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Prompting for ticket closing reason',
 });

 if (res instanceof RequestHandlerError) {
  this.nonFatalError(
   new Error('Failed to open the closing-reason modal', { cause: res }),
   'tickets/close',
  );
 }
}
