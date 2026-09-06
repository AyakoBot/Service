import { txtFileWriter } from '@ayako/utility';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import {
 ApplicationCommandType,
 MessageFlags,
 type APIApplicationCommandInteraction,
 type APIMessageApplicationCommandInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { Colors } from '../../../../Types/index.js';
import type InfoPlugin from '../../Plugin.js';
import { fitJsonBlock } from '../../Util/jsonBlock.js';

export default async function (this: InfoPlugin, cmd: APIApplicationCommandInteraction) {
 if (cmd.data.type !== ApplicationCommandType.Message) return;

 const interaction = cmd as APIMessageApplicationCommandInteraction;
 const message = interaction.data.resolved.messages[interaction.data.target_id];
 if (!message) return;

 const json = JSON.stringify(message, null, 2);
 const preview = fitJsonBlock(json);

 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Raw message view',
 })
  .setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral)
  .setComponents([
   new ContainerBuilder()
    .setAccentColor(Colors.Ephemeral)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(preview.content))
    .toJSON(),
  ]);

 if (preview.truncated) payload.setFiles([txtFileWriter(json, 'Raw_Message')]);

 payload.reply(cmd);
}
