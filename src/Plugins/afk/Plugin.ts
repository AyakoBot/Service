import {
 SlashCommandBuilder,
 SlashCommandStringOption,
 SlashCommandSubcommandBuilder,
} from '@discordjs/builders';
import {
 ApplicationIntegrationType,
 GatewayDispatchEvents,
 InteractionContextType,
} from '@discordjs/core';

import Plugin from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import type { ExtractPayload } from '../../Types/gateway.js';

import { AfkCommand } from './Enums.js';
import InteractionCreate from './Events/InteractionCreate/index.js';
import MessageCreate from './Events/MessageCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.MessageCreate | GatewayDispatchEvents.InteractionCreate;
type AFKLanguage = typeof en;

export default class AFKPlugin extends Plugin<Events, AFKLanguage> {
 name = 'AFK';
 settingName = 'afk';
 tableName = 'AFKSetting';

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {
  [GatewayDispatchEvents.MessageCreate]: (
   data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
  ) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove

   this.logger.debug(`[Plugin:${this.name}] MessageCreate event received`);
   if (!this.isEnabled()) return;
   this.logger.debug(`[Plugin:${this.name}] Processing MessageCreate event`);
   MessageCreate.call(this, data);
  },

  [GatewayDispatchEvents.InteractionCreate]: (
   data: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
  ) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove

   this.logger.debug(`[Plugin:${this.name}] InteractionCreate event received`);
   if (!this.isEnabled()) return;
   this.logger.debug(`[Plugin:${this.name}] Processing InteractionCreate event`);
   InteractionCreate.call(this, data);
  },
 };

 constructor(client: Client) {
  super(client);
 }

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName(AfkCommand.Afk)
    .setDescription('Set your AFK Status')
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .addStringOption(
     new SlashCommandStringOption()
      .setName('reason')
      .setDescription('The Reason for being AFK')
      .setRequired(false),
    ),
  ],
  settings: [
   {
    category: null,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName(AfkCommand.Afk)
      .setDescription('Make adjustments to the AFK-Command and what can be set as AFK-Status'),
    ],
   },
  ],
 });
}
