import {
 SlashCommandBooleanOption,
 SlashCommandBuilder,
 SlashCommandStringOption,
} from '@discordjs/builders';
import {
 ApplicationIntegrationType,
 GatewayDispatchEvents,
 InteractionContextType,
 PermissionFlagsBits,
} from '@discordjs/core';
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord-api-types/v10';

import Plugin, { PluginName } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import type { ExtractPayload } from '../../Types/gateway.js';

import { HelpCommand, HelpOption } from './Classes/Commands.js';
import HelpRegistry from './Classes/HelpRegistry.js';
import HelpSession from './Classes/HelpSession.js';
import InteractionCreate from './Events/InteractionCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.InteractionCreate;
type HelpLanguage = typeof en;

const commandOption = () =>
 new SlashCommandStringOption()
  .setName(HelpOption.Command)
  .setDescription('A Command to explain (leave empty for the full overview)')
  .setAutocomplete(true)
  .setRequired(false);

const allOption = () =>
 new SlashCommandBooleanOption()
  .setName(HelpOption.All)
  .setDescription('List every Command instead of showing the overview')
  .setRequired(false);

export default class HelpPlugin extends Plugin<Events, HelpLanguage> {
 name = 'Help';
 settingName = PluginName.Help;
 tableName = '';

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {
  [GatewayDispatchEvents.InteractionCreate]: (
   data: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
  ) => {
   if (!this.isEnabled()) return;
   InteractionCreate.call(this, data);
  },
 };

 constructor(client: Client) {
  super(client);

  this.help = new HelpRegistry(this);
  this.sessions = new HelpSession();
 }

 help: HelpRegistry;
 sessions: HelpSession;

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName(HelpCommand.Help)
    .setDescription('Learn what this Bot can do')
    .setContexts([
     InteractionContextType.Guild,
     InteractionContextType.BotDM,
     InteractionContextType.PrivateChannel,
    ])
    .setIntegrationTypes([
     ApplicationIntegrationType.GuildInstall,
     ApplicationIntegrationType.UserInstall,
    ])
    .addStringOption(commandOption())
    .addBooleanOption(allOption()),
   new SlashCommandBuilder()
    .setName(HelpCommand.Plugins)
    .setDescription('See the other Ayako Bots and what each of them does')
    .setContexts([
     InteractionContextType.Guild,
     InteractionContextType.BotDM,
     InteractionContextType.PrivateChannel,
    ])
    .setIntegrationTypes([
     ApplicationIntegrationType.GuildInstall,
     ApplicationIntegrationType.UserInstall,
    ]),
  ],
  settings: [],
 });

 getUniversalCommands = (): RESTPostAPIChatInputApplicationCommandsJSONBody[] => {
  const bodies = this.getCommands().commands.map((command) =>
   command.toJSON(),
  ) as RESTPostAPIChatInputApplicationCommandsJSONBody[];

  const help = bodies.find((body) => body.name === HelpCommand.Help);
  const plugins = bodies.find((body) => body.name === HelpCommand.Plugins);

  if (!help || !plugins) {
   this.nonFatalError(
    new Error('Universal commands missing from the help command surface'),
    'getUniversalCommands',
   );
   return [];
  }

  return [help, plugins];
 };
}
