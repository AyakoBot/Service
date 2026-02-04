import { logger } from '@ayako/utility';
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

import InteractionCreate from './Events/InteractionCreate/index.js';
import MessageCreate from './Events/MessageCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.MessageCreate | GatewayDispatchEvents.InteractionCreate;
type AFKLanguage = typeof en;

export default class AFKPlugin extends Plugin<Events, AFKLanguage> {
 name = 'AFK';

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {
  [GatewayDispatchEvents.MessageCreate]: (
   data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
  ) => {
   logger.debug('[AFKPlugin] MessageCreate event received');
   if (!this.enabled) return;
   logger.debug('[AFKPlugin] Processing MessageCreate event');
   MessageCreate.call(this, data);
  },

  [GatewayDispatchEvents.InteractionCreate]: (
   data: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
  ) => {
   logger.debug('[AFKPlugin] InteractionCreate event received');
   if (!this.enabled) return;
   logger.debug('[AFKPlugin] Processing InteractionCreate event');
   InteractionCreate.call(this, data);
  },
 };

 constructor(client: Client) {
  super(client);
 }

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName('afk')
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
      .setName('afk')
      .setDescription('Make adjustments to the AFK-Command and what can be set as AFK-Status'),
    ],
   },
  ],
 });
}
