import { PresenceActivityType, type WelcomeSetting } from '@ayako/database';
import { decrypt, LogLevel, SatelliteChannel } from '@ayako/utility';
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
 withBasePlaceholders,
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
import {
 BotProfilePart,
 welcomeBotTokenTransform,
 welcomePresenceEmojiTransform,
 welcomeProfileImageTransform,
 welcomeProfileVirtual,
} from './Util/botToken.js';
import { savedRefTransform } from './Util/savedRefTransform.js';

type Events =
 | GatewayDispatchEvents.GuildAuditLogEntryCreate
 | GatewayDispatchEvents.GuildMemberAdd
 | GatewayDispatchEvents.GuildMemberUpdate
 | GatewayDispatchEvents.GuildMemberRemove
 | GatewayDispatchEvents.InteractionCreate;

type WelcomeLanguage = typeof en;
type WelcomeTranslator = TranslatorType<WelcomeLanguage> & { base: BaseLang };

type WelcomeVirtualColumns = {
 profileNick: string | null;
 profileAvatar: string | null;
 profileBanner: string | null;
 profileBio: string | null;
};

export enum WelcomeGroups {
 Welcome = 'welcome',
 Goodbye = 'goodbye',
 Bot = 'bot',
 Presence = 'presence',
 Profile = 'profile',
}

export enum WelcomeGuideFlag {
 WantsGoodbye = 1 << 0,
}

const welcomePlaceholders = withBasePlaceholders(MessagePlaceholder.Gif);
const placeholderDoc = buildPlaceholderDoc(MessagePlaceholder.Gif);

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
   if (!this.isEnabled()) return;

   guildAuditLogEntryCreate.call(this, data);
  },
  GUILD_MEMBER_ADD: (data) => {
   if (!this.isEnabled()) return;

   guildMemberAdd.call(this, data);
  },
  GUILD_MEMBER_UPDATE: (data) => {
   if (!this.isEnabled()) return;

   guildMemberUpdate.call(this, data);
  },
  GUILD_MEMBER_REMOVE: (data) => {
   if (!this.isEnabled()) return;

   guildMemberRemove.call(this, data);
  },
  INTERACTION_CREATE: (data) => {
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

 getEmojiSyncTokens = async (): Promise<string[]> => {
  const rows = await this.client.db.client.welcomeSetting.findMany({
   where: { botToken: { not: null } },
   select: { botToken: true },
  });

  return [...new Set(rows.map((row) => row.botToken))].flatMap((cipher) => {
   if (!cipher) return [];
   try {
    return [decrypt(cipher)];
   } catch {
    return [];
   }
  });
 };

 reconcileSatellites = () => {
  this.client.cache.cachePub
   .publish(SatelliteChannel.Reconcile, '')
   .catch((e: Error) => this.nonFatalError(e, 'reconcileSatellites'));
 };

 invalidateToken = async (cipher: string): Promise<void> => {
  await this.client.db.client.welcomeSetting.updateMany({
   where: { botToken: cipher },
   data: { botToken: null },
  });
 };

 getCustomBotTargets = async (): Promise<Array<{ token: string; guildId: string }>> => {
  const rows = await this.client.db.client.welcomeSetting.findMany({
   where: { botToken: { not: null } },
   select: { guild: true, botToken: true },
  });

  return rows.flatMap((row) => {
   if (!row.botToken) return [];

   try {
    return [{ token: decrypt(row.botToken), guildId: row.guild }];
   } catch {
    return [];
   }
  });
 };

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
   {
    id: WelcomeGroups.Bot,
    label: (t: WelcomeTranslator) => t.settings.groups.bot(),
    fields: [
     {
      column: 'botToken',
      editor: EditorType.BotToken,
      label: (t: WelcomeTranslator) => t.settings.fields.botToken(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.botToken(),
      arity: FieldArity.Single,
      secret: true,
      transform: welcomeBotTokenTransform,
     },
    ],
   },
   {
    id: WelcomeGroups.Presence,
    label: (t: WelcomeTranslator) => t.settings.groups.presence(),
    emote: EmoteName.Bot,
    fields: [
     {
      column: 'presenceType',
      editor: EditorType.PresenceActivityType,
      label: (t: WelcomeTranslator) => t.settings.fields.presenceType(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.presenceType(),
      arity: FieldArity.Single,
      showIf: (row) => ({ ok: Boolean(row.botToken), reason: en.settings.reasons.customBotOnly }),
      options: [
       {
        value: PresenceActivityType.Playing,
        label: (t: WelcomeTranslator) => t.settings.options.playing(),
       },
       {
        value: PresenceActivityType.Listening,
        label: (t: WelcomeTranslator) => t.settings.options.listening(),
       },
       {
        value: PresenceActivityType.Watching,
        label: (t: WelcomeTranslator) => t.settings.options.watching(),
       },
       {
        value: PresenceActivityType.Competing,
        label: (t: WelcomeTranslator) => t.settings.options.competing(),
       },
       {
        value: PresenceActivityType.Custom,
        label: (t: WelcomeTranslator) => t.settings.options.custom(),
       },
      ],
     },
     {
      column: 'presenceText',
      editor: EditorType.String,
      label: (t: WelcomeTranslator) => t.settings.fields.presenceText(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.presenceText(),
      showIf: (row) => ({
       ok: Boolean(row.botToken) && Boolean(row.presenceType),
       reason: row.botToken
        ? en.settings.reasons.presenceTypeUnset
        : en.settings.reasons.customBotOnly,
      }),
     },
     {
      column: 'presenceEmoji',
      editor: EditorType.String,
      transform: welcomePresenceEmojiTransform,
      label: (t: WelcomeTranslator) => t.settings.fields.presenceEmoji(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.presenceEmoji(),
      showIf: (row) => ({
       ok: Boolean(row.botToken) && row.presenceType === PresenceActivityType.Custom,
       reason: row.botToken
        ? en.settings.reasons.customStatusOnly
        : en.settings.reasons.customBotOnly,
      }),
     },
    ],
   },
   {
    id: WelcomeGroups.Profile,
    label: (t: WelcomeTranslator) => t.settings.groups.profile(),
    emote: EmoteName.Image,
    fields: [
     {
      column: 'profileNick',
      editor: EditorType.String,
      label: (t: WelcomeTranslator) => t.settings.fields.profileNick(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.profileNick(),
      arity: FieldArity.Single,
      virtual: welcomeProfileVirtual(BotProfilePart.Nick),
     },
     {
      column: 'profileAvatar',
      editor: EditorType.String,
      label: (t: WelcomeTranslator) => t.settings.fields.profileAvatar(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.profileAvatar(),
      arity: FieldArity.Single,
      transform: welcomeProfileImageTransform,
      virtual: welcomeProfileVirtual(BotProfilePart.Avatar),
     },
     {
      column: 'profileBanner',
      editor: EditorType.String,
      label: (t: WelcomeTranslator) => t.settings.fields.profileBanner(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.profileBanner(),
      arity: FieldArity.Single,
      transform: welcomeProfileImageTransform,
      virtual: welcomeProfileVirtual(BotProfilePart.Banner),
     },
     {
      column: 'profileBio',
      editor: EditorType.String,
      label: (t: WelcomeTranslator) => t.settings.fields.profileBio(),
      description: (t: WelcomeTranslator) => t.settings.descriptions.profileBio(),
      arity: FieldArity.Single,
      multiline: true,
      virtual: welcomeProfileVirtual(BotProfilePart.Bio),
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
 } satisfies SettingsSchemaDef<
  WelcomeSetting & WelcomeVirtualColumns,
  WelcomeTranslator
 > as unknown as SettingsSchemaDef;
}
