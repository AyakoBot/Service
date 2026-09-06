import {
 ContextMenuCommandBuilder,
 SlashCommandBooleanOption,
 SlashCommandBuilder,
 SlashCommandChannelOption,
 SlashCommandRoleOption,
 SlashCommandStringOption,
 SlashCommandSubcommandBuilder,
 SlashCommandUserOption,
} from '@discordjs/builders';
import {
 ApplicationCommandType,
 ApplicationIntegrationType,
 GatewayDispatchEvents,
 InteractionContextType,
 PermissionFlagsBits,
} from '@discordjs/core';

import Plugin, { PluginName } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import type { ExtractPayload } from '../../Types/gateway.js';

import { InfoCommand, InfoOption, InfoSubcommand } from './Classes/Commands.js';
import InteractionCreate from './Events/InteractionCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.InteractionCreate;
type InfoLanguage = typeof en;

const hideOption = () =>
 new SlashCommandBooleanOption()
  .setName(InfoOption.Hide)
  .setDescription('Whether only you can see the response')
  .setRequired(false);

const userOption = () =>
 new SlashCommandUserOption()
  .setName(InfoOption.User)
  .setDescription('The User (defaults to you)')
  .setRequired(false);

const subcommand = (name: InfoSubcommand, description: string) =>
 new SlashCommandSubcommandBuilder().setName(name).setDescription(description);

export default class InfoPlugin extends Plugin<Events, InfoLanguage> {
 name = 'Info';
 settingName = PluginName.Info;
 tableName = '';

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.ReadMessageHistory;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {
  [GatewayDispatchEvents.InteractionCreate]: (
   data: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
  ) => {
   if (
    !this.client.cutoverFeatures.includes(this.name) &&
    (!data.guild_id
     ? !this.client.debugUsers.includes(data.user?.id || '')
     : !this.client.debugGuilds.includes(data.guild_id))
   ) {
    return; // TODO: remove
   }

   if (!this.isEnabled()) return;
   InteractionCreate.call(this, data);
  },
 };

 constructor(client: Client) {
  super(client);

  this.pluginBotKey = 'INFO_TOKEN';
 }

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName(InfoCommand.Info)
    .setDescription('Display Information about anything on Discord')
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .addSubcommand(
     subcommand(InfoSubcommand.User, 'Display Information about a User')
      .addUserOption(userOption())
      .addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Avatar, 'Display the Avatar of a User')
      .addUserOption(userOption())
      .addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Banner, 'Display the Banner of a User')
      .addUserOption(userOption())
      .addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Server, 'Display Information about a Server')
      .addStringOption(
       new SlashCommandStringOption()
        .setName(InfoOption.ServerId)
        .setDescription('The ID of the Server (defaults to this Server)')
        .setRequired(false),
      )
      .addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Channel, 'Display Information about a Channel')
      .addChannelOption(
       new SlashCommandChannelOption()
        .setName(InfoOption.Channel)
        .setDescription('The Channel')
        .setRequired(true),
      )
      .addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Role, 'Display Information about a Role')
      .addRoleOption(
       new SlashCommandRoleOption()
        .setName(InfoOption.Role)
        .setDescription('The Role')
        .setRequired(true),
      )
      .addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Emoji, 'Display Information about an Emoji or list all Emojis')
      .addStringOption(
       new SlashCommandStringOption()
        .setName(InfoOption.Emoji)
        .setDescription('The Emoji or Emoji ID (leave empty to list all)')
        .setRequired(false),
      )
      .addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Sticker, 'Display Information about a Sticker or list all Stickers')
      .addStringOption(
       new SlashCommandStringOption()
        .setName(InfoOption.Sticker)
        .setDescription('A Message Link to or ID of the Sticker (leave empty to list all)')
        .setRequired(false),
      )
      .addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Invite, 'Display Information about an Invite')
      .addStringOption(
       new SlashCommandStringOption()
        .setName(InfoOption.Invite)
        .setDescription('The Invite Link or Code')
        .setRequired(true),
      )
      .addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Bot, 'Display Information about this Bot').addBooleanOption(
      hideOption(),
     ),
    )
    .addSubcommand(
     subcommand(
      InfoSubcommand.Badges,
      'Display the Discord Badges Members of this Server have',
     ).addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Servers, 'Display all Servers this Bot is in').addBooleanOption(
      hideOption(),
     ),
    )
    .addSubcommand(
     subcommand(
      InfoSubcommand.Events,
      'Display the Scheduled Events of this Server',
     ).addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(InfoSubcommand.Webhook, 'Display Information about a Webhook')
      .addStringOption(
       new SlashCommandStringOption()
        .setName(InfoOption.Url)
        .setDescription('The Webhook URL')
        .setRequired(true),
      )
      .addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(
      InfoSubcommand.Automod,
      'Display the Auto-Moderation Rules of this Server',
     ).addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(
      InfoSubcommand.Soundboard,
      'Display the Soundboard Sounds of this Server',
     ).addBooleanOption(hideOption()),
    )
    .addSubcommand(
     subcommand(
      InfoSubcommand.Permissions,
      'Display the Permissions of a User or Role, server-wide or in a Channel',
     )
      .addUserOption(
       new SlashCommandUserOption()
        .setName(InfoOption.User)
        .setDescription('The User (provide either a User or a Role)')
        .setRequired(false),
      )
      .addRoleOption(
       new SlashCommandRoleOption()
        .setName(InfoOption.Role)
        .setDescription('The Role (provide either a User or a Role)')
        .setRequired(false),
      )
      .addChannelOption(
       new SlashCommandChannelOption()
        .setName(InfoOption.Channel)
        .setDescription('The Channel to check Permissions in (defaults to server-wide)')
        .setRequired(false),
      ),
    ),
   new SlashCommandBuilder()
    .setName(InfoCommand.MemberCount)
    .setDescription('Display the Membercount of this Server')
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]),
   new SlashCommandBuilder()
    .setName(InfoCommand.Ping)
    .setDescription("Display this Bot's Ping")
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]),
   new ContextMenuCommandBuilder()
    .setName(InfoCommand.ViewRaw)
    .setType(ApplicationCommandType.Message)
    .setContexts([
     InteractionContextType.Guild,
     InteractionContextType.BotDM,
     InteractionContextType.PrivateChannel,
    ])
    .setIntegrationTypes([
     ApplicationIntegrationType.GuildInstall,
     ApplicationIntegrationType.UserInstall,
    ]),
   new ContextMenuCommandBuilder()
    .setName(InfoCommand.MessageHistory)
    .setType(ApplicationCommandType.Message)
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]),
  ],
  settings: [],
 });
}
