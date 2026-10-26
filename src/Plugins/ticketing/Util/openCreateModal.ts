import { RequestHandlerError } from '@ayako/api';
import type { TicketSetting } from '@ayako/database';
import { LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import { TextInputStyle, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { openingTextField, TicketRoute } from '../Classes/Routes.js';
import type TicketPlugin from '../Plugin.js';

import getTicketClassBySettingsType from './getTicketClassBySettingsType.js';
import handleTicketError from './handleTicketError.js';

const titleLimit = 45;
const textLimit = 1000;

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 settings: TicketSetting,
 member: { userId: string; roleIds: string[] },
) {
 const settingsId = String(settings.id);
 const ticket = getTicketClassBySettingsType.call(this.client, settings.type, '0');
 const allowed = await ticket
  .assertCanCreate({ settingsId, userId: member.userId }, member)
  .then(() => true)
  .catch((error: Error) => {
   handleTicketError.call(this.client, { guildId: settings.guild, error, cmd });
   return false;
  });
 if (!allowed) return;

 const t = await this.t(settings.guild);
 const title = settings.name || settings.panelButtonLabel || t.startTicket();

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(TicketRoute.CreateModal, settingsId))
  .setTitle(title.slice(0, titleLimit))
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.createModalLabel())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId(openingTextField)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(textLimit),
    ),
  );

 const api = await this.getInteractionAPI(cmd);
 const res = await api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Asking what the ticket is about',
 });

 if (res instanceof RequestHandlerError) {
  this.nonFatalError(
   new Error('Failed to open the ticket modal', { cause: res }),
   TicketRoute.Create,
  );
 }
}
