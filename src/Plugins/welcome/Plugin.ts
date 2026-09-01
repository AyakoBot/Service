import type { WelcomeSetting } from '@ayako/database';
import { LogLevel } from '@ayako/utility';
import { ContextMenuCommandBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import {
 ApplicationCommandType,
 ApplicationIntegrationType,
 InteractionContextType,
 PermissionFlagsBits,
 type GatewayDispatchEvents,
} from '@discordjs/core';
import { ChannelType } from 'discord-api-types/v10';

import Plugin, {
 PluginName,
 SettingsCategory,
 type BaseLang,
} from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import { EmoteName } from '../../Classes/EmoteName.js';
import {
 MessagePlaceholder,
 placeholderDoc as buildPlaceholderDoc,
} from '../../Util/messagePlaceholders.js';
import type { TranslatorType } from '../../Util/translator.js';
import { EditorType } from '../settings/Plugin.js';
import {
 assertSchemaValid,
 FieldArity,
 type SettingsSchemaDef,
} from '../settings/SettingsSchema.js';

import { WelcomeCommand, WelcomeSubcommand } from './Classes/Commands.js';
import { SavedSource } from './Classes/Enums.js';
import { WelcomeRoute } from './Classes/Routes.js';
import guildAuditLogEntryCreate from './Events/GuildAuditLogEntryCreate/index.js';
import guildMemberAdd from './Events/GuildMemberAdd/index.js';
import guildMemberRemove from './Events/GuildMemberRemove/index.js';
import guildMemberUpdate from './Events/GuildMemberUpdate/index.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };
import { savedRefTransform } from './Util/savedRefTransform.js';

type Events =
 | GatewayDispatchEvents.GuildAuditLogEntryCreate
 | GatewayDispatchEvents.GuildMemberAdd
 | GatewayDispatchEvents.GuildMemberUpdate
 | GatewayDispatchEvents.GuildMemberRemove
 | GatewayDispatchEvents.InteractionCreate;

type WelcomeLanguage = typeof en;
type WelcomeTranslator = TranslatorType<WelcomeLanguage> & { base: BaseLang };

export enum WelcomeGroups {
 Welcome = 'welcome',
 Goodbye = 'goodbye',
}

export enum WelcomeGuideFlag {
 WantsGoodbye = 1 << 0,
}

const welcomePlaceholders = [MessagePlaceholder.Gif];
const placeholderDoc = buildPlaceholderDoc(...welcomePlaceholders);

const greetingChannelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export default class WelcomePlugin extends Plugin<Events, WelcomeLanguage> {
 name = 'Welcome';
 settingName = PluginName.Welcome;
 dependencies = [PluginName.Settings, PluginName.EmbedBuilder, PluginName.ComponentBuilder];
 tableName = 'WelcomeSetting';
 placeholders = welcomePlaceholders;

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.MentionEveryone;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };

 eventHandlers = {
  GUILD_AUDIT_LOG_ENTRY_CREATE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove
   if (!this.isEnabled()) return;

   guildAuditLogEntryCreate.call(this, data);
  },
  GUILD_MEMBER_ADD: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove
   if (!this.isEnabled()) return;

   guildMemberAdd.call(this, data);
  },
  GUILD_MEMBER_UPDATE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove
   if (!this.isEnabled()) return;

   guildMemberUpdate.call(this, data);
  },
  GUILD_MEMBER_REMOVE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove
   if (!this.isEnabled()) return;

   guildMemberRemove.call(this, data);
  },
  INTERACTION_CREATE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
 } as Plugin<Events, WelcomeLanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 constructor(client: Client) {
  super(client);

  this.pluginBotKey = 'WELCOME_TOKEN';
  this.logger.setLevel(LogLevel.silly);

  assertSchemaValid(this.settingsSchema);
 }

 onGuildRemoved = async (guildId: string) => {
  await this.client.db.client.welcomeGif.deleteMany({ where: { guild: guildId } });
  await this.client.db.client.welcomeSetting.deleteMany({ where: { guild: guildId } });
 };

 getCommands = () => ({
  commands: [
   new ContextMenuCommandBuilder()
    .setName(WelcomeCommand.SaveGifWelcome)
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]),
   new ContextMenuCommandBuilder()
    .setName(WelcomeCommand.SaveGifGoodbye)
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]),
  ],
  settings: [
   {
    category: SettingsCategory.Automation,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName(PluginName.Welcome)
      .setDescription('Configure welcome and goodbye messages'),
     new SlashCommandSubcommandBuilder()
      .setName(WelcomeSubcommand.WelcomeGifs)
      .setDescription('Manage the random GIF pool for welcome messages'),
     new SlashCommandSubcommandBuilder()
      .setName(WelcomeSubcommand.GoodbyeGifs)
      .setDescription('Manage the random GIF pool for goodbye messages'),
    ],
   },
  ],
 });

 settingsSchema = {
  table: 'welcomeSetting',
  rowKey: 'id',
  multiRow: false,
  title: (t: WelcomeTranslator) => t.settings.configTitle(),
  overviewDescription: (t: WelcomeTranslator) => t.settings.overviewDescription(),
  rowLabel: (t: WelcomeTranslator) => t.settings.configTitle(),
  groups: [
   {
    id: WelcomeGroups.Welcome,
    label: (t: WelcomeTranslator) => t.settings.groups.welcome(),
    fields: [
     {
      column: 'welcomeActive',
      editor: EditorType.Boolean,
      label: (t: WelcomeTranslator) => t.settings.fields.active(),
      headerToggle: true,
     },
     {
      column: 'welcomeChannel',
      editor: EditorType.Channel,
      label: (t: WelcomeTranslator) => t.settings.fields.channel(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.welcomeChannel(),
      arity: FieldArity.Single,
      channelTypes: greetingChannelTypes,
      required: true,
     },
     {
      column: 'welcomeEmbed',
      editor: EditorType.String,
      label: (t: WelcomeTranslator) => t.settings.fields.embed(),
      description: (t: WelcomeTranslator) =>
       t.settings.descriptions.embed({ list: placeholderDoc }),
      arity: FieldArity.Single,
      transform: savedRefTransform(SavedSource.Embed, { welcomeComponents: null }),
     },
     {
      column: 'welcomeComponents',
      editor: EditorType.String,
      label: (t: WelcomeTranslator) => t.settings.fields.components(),
      description: (t: WelcomeTranslator) =>
       t.settings.descriptions.components({ list: placeholderDoc }),
      arity: FieldArity.Single,
      transform: savedRefTransform(SavedSource.Components, { welcomeEmbed: null }),
     },
     {
      column: 'welcomePingJoin',
      editor: EditorType.Boolean,
      label: (t: WelcomeTranslator) => t.settings.fields.pingJoin(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.pingJoin(),
     },
     {
      column: 'welcomePingRoles',
      editor: EditorType.Roles,
      label: (t: WelcomeTranslator) => t.settings.fields.pingRoles(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.pingRoles(),
      arity: FieldArity.Multi,
     },
     {
      column: 'welcomePingUsers',
      editor: EditorType.Users,
      label: (t: WelcomeTranslator) => t.settings.fields.pingUsers(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.pingUsers(),
      arity: FieldArity.Multi,
     },
    ],
    actions: [
     {
      customId: WelcomeRoute.TestWelcome,
      label: (t: WelcomeTranslator) => t.settings.actions.testWelcome(),
      description: (t: WelcomeTranslator) => t.settings.actions.testDesc(),
      buttonLabel: (t: WelcomeTranslator) => t.settings.actions.testButton(),
      emote: EmoteName.Send,
     },
     {
      customId: WelcomeRoute.GifsWelcome,
      label: (t: WelcomeTranslator) => t.settings.actions.gifs(),
      description: (t: WelcomeTranslator) => t.settings.actions.gifsDesc(),
      buttonLabel: (t: WelcomeTranslator) => t.settings.actions.gifsButton(),
      emote: EmoteName.Image,
     },
    ],
   },
   {
    id: WelcomeGroups.Goodbye,
    label: (t: WelcomeTranslator) => t.settings.groups.goodbye(),
    fields: [
     {
      column: 'goodbyeActive',
      editor: EditorType.Boolean,
      label: (t: WelcomeTranslator) => t.settings.fields.active(),
      headerToggle: true,
     },
     {
      column: 'goodbyeChannel',
      editor: EditorType.Channel,
      label: (t: WelcomeTranslator) => t.settings.fields.channel(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.goodbyeChannel(),
      arity: FieldArity.Single,
      channelTypes: greetingChannelTypes,
      required: true,
     },
     {
      column: 'goodbyeEmbed',
      editor: EditorType.String,
      label: (t: WelcomeTranslator) => t.settings.fields.embed(),
      description: (t: WelcomeTranslator) =>
       t.settings.descriptions.embed({ list: placeholderDoc }),
      arity: FieldArity.Single,
      transform: savedRefTransform(SavedSource.Embed, { goodbyeComponents: null }),
     },
     {
      column: 'goodbyeComponents',
      editor: EditorType.String,
      label: (t: WelcomeTranslator) => t.settings.fields.components(),
      description: (t: WelcomeTranslator) =>
       t.settings.descriptions.components({ list: placeholderDoc }),
      arity: FieldArity.Single,
      transform: savedRefTransform(SavedSource.Components, { goodbyeEmbed: null }),
     },
     {
      column: 'goodbyePingRoles',
      editor: EditorType.Roles,
      label: (t: WelcomeTranslator) => t.settings.fields.pingRoles(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.pingRoles(),
      arity: FieldArity.Multi,
     },
     {
      column: 'goodbyePingUsers',
      editor: EditorType.Users,
      label: (t: WelcomeTranslator) => t.settings.fields.pingUsers(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.pingUsers(),
      arity: FieldArity.Multi,
     },
    ],
    actions: [
     {
      customId: WelcomeRoute.TestGoodbye,
      label: (t: WelcomeTranslator) => t.settings.actions.testGoodbye(),
      description: (t: WelcomeTranslator) => t.settings.actions.testDesc(),
      buttonLabel: (t: WelcomeTranslator) => t.settings.actions.testButton(),
      emote: EmoteName.Send,
     },
     {
      customId: WelcomeRoute.GifsGoodbye,
      label: (t: WelcomeTranslator) => t.settings.actions.gifs(),
      description: (t: WelcomeTranslator) => t.settings.actions.gifsDesc(),
      buttonLabel: (t: WelcomeTranslator) => t.settings.actions.gifsButton(),
      emote: EmoteName.Image,
     },
    ],
   },
  ],
  guide: {
   title: (t: WelcomeTranslator) => t.guide.title(),
   intro: (t: WelcomeTranslator) => t.guide.intro(),
   advert: {
    text: (t: WelcomeTranslator) => t.guide.advertText(),
    buttonLabel: (t: WelcomeTranslator) => t.guide.advertButton(),
    emote: EmoteName.Member,
   },
   sections: [
    {
     id: WelcomeGroups.Welcome,
     label: (t: WelcomeTranslator) => t.settings.groups.welcome(),
     description: (t: WelcomeTranslator) => t.guide.sectionDesc.welcome(),
     emote: EmoteName.Member,
     steps: [
      {
       column: 'welcomeChannel',
       label: (t: WelcomeTranslator) => t.settings.fields.channel(),
       required: true,
      },
      {
       column: 'welcomeEmbed',
       label: (t: WelcomeTranslator) => t.settings.fields.embed(),
      },
      {
       column: 'welcomeComponents',
       label: (t: WelcomeTranslator) => t.settings.fields.components(),
      },
      {
       column: 'welcomePingJoin',
       label: (t: WelcomeTranslator) => t.settings.fields.pingJoin(),
      },
      {
       column: 'welcomeActive',
       label: (t: WelcomeTranslator) => t.guide.enableWelcome(),
       required: true,
      },
     ],
    },
    {
     id: WelcomeGroups.Goodbye,
     label: (t: WelcomeTranslator) => t.settings.groups.goodbye(),
     description: (t: WelcomeTranslator) => t.guide.sectionDesc.goodbye(),
     emote: EmoteName.Message,
     gate: {
      flag: WelcomeGuideFlag.WantsGoodbye,
      question: (t: WelcomeTranslator) => t.guide.gates.goodbye(),
     },
     steps: [
      {
       column: 'goodbyeChannel',
       label: (t: WelcomeTranslator) => t.settings.fields.channel(),
       required: true,
      },
      {
       column: 'goodbyeEmbed',
       label: (t: WelcomeTranslator) => t.settings.fields.embed(),
      },
      {
       column: 'goodbyeComponents',
       label: (t: WelcomeTranslator) => t.settings.fields.components(),
      },
      {
       column: 'goodbyeActive',
       label: (t: WelcomeTranslator) => t.guide.enableGoodbye(),
       required: true,
      },
     ],
    },
   ],
  },
 } satisfies SettingsSchemaDef<WelcomeSetting, WelcomeTranslator> as unknown as SettingsSchemaDef;
}
