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
import { containerCharBudget } from '../../../../Util/fmt.js';
import type InfoPlugin from '../../Plugin.js';

const zeroWidth = String.fromCharCode(0x200b);
const escapeCodeBlock = (content: string): string =>
 content.replaceAll('```', `\`${zeroWidth}\`\``);

export default async function (this: InfoPlugin, cmd: APIApplicationCommandInteraction) {
 if (cmd.data.type !== ApplicationCommandType.Message) return;

 const interaction = cmd as APIMessageApplicationCommandInteraction;
 const message = interaction.data.resolved.messages[interaction.data.target_id];
 if (!message) return;

 const json = JSON.stringify(message, null, 2);

 const payload = new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Raw message view',
 }).setFlags(MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral);

 if (json.length > containerCharBudget) {
  payload
   .setComponents([
    new ContainerBuilder()
     .setAccentColor(Colors.Ephemeral)
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       `\`\`\`json\n${escapeCodeBlock(json.slice(0, 200))}…\n\`\`\``,
      ),
     )
     .toJSON(),
   ])
   .setFiles([txtFileWriter(json, 'Raw_Message')]);
 } else {
  payload.setComponents([
   new ContainerBuilder()
    .setAccentColor(Colors.Ephemeral)
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(`\`\`\`json\n${escapeCodeBlock(json)}\n\`\`\``),
    )
    .toJSON(),
  ]);
 }

 payload.reply(cmd);
}
