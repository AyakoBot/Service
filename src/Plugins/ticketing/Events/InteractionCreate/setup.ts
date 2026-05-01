import {
 ButtonStyle,
 type APIApplicationCommandInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';
import type TicketPlugin from '../../Plugin.js';
import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';

export default async function (this: TicketPlugin, cmd: APIApplicationCommandInteraction) {
 // TODO: replace
 new MessagePayload(this.client, { origin: this.name, reason: 'Setting up ticketing plugin' })
  .setContent('Placeholder Message')
  .addComponents(
   new ActionRowBuilder()
    .setComponents(
     new ButtonBuilder()
      .setLabel('awa')
      .setCustomId('tickets/create_1775233566995')
      .setStyle(ButtonStyle.Primary),
    )
    .toJSON() as APIMessageTopLevelComponent,
  )
  .reply(cmd);
}
