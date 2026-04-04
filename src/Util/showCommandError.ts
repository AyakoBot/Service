import { MessageFlags, type APIInteraction } from 'discord-api-types/v10';
import type Client from '../Classes/Client.js';
import type { BaseLang } from '../Classes/abstracts/Plugin.js';
import { MessagePayload } from '../Classes/abstracts/MessagePayload.js';
import { ContainerBuilder, TextDisplayBuilder } from '@discordjs/builders';
import { Colors } from '../Types/index.js';

export default async function (this: Client, error: string, cmd: APIInteraction, t: BaseLang) {
 this.logger.error(`Error executing command: ${error}`);

 const api = await this.getAPI(cmd.guild_id);
 if (!api) {
  this.logger.error('API instance not found for guild:', cmd.guild_id);
  return;
 }

 new MessagePayload(this, {
  origin: 'showCommandError',
  reason: 'Showing the executing user an error',
 })
  .setComponents([
   new ContainerBuilder()
    .setAccentColor(Colors.Danger)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${t.t.error()}\n-# ${error}`))
    .toJSON(),
  ])
  .setFlags(MessageFlags.IsComponentsV2)
  .reply(cmd);
}
