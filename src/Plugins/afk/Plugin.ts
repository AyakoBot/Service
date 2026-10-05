import type { AfkSetting } from '@ayako/database';
import {
 SlashCommandBuilder,
 SlashCommandIntegerOption,
 SlashCommandStringOption,
 SlashCommandSubcommandBuilder,
 SlashCommandSubcommandGroupBuilder,
 SlashCommandUserOption,
} from '@discordjs/builders';
import {
 ApplicationIntegrationType,
 GatewayDispatchEvents,
 InteractionContextType,
 PermissionFlagsBits,
} from '@discordjs/core';

import Plugin, { PluginName, type BaseLang } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import type { ExtractPayload } from '../../Types/gateway.js';
import { PluginBotKey } from '../../Util/pluginBotKey.js';
import type { TranslatorType } from '../../Util/translator.js';
import { EditorType } from '../settings/Plugin.js';
import {
 FieldArity,
 type FieldTransform,
 type SettingsSchemaDef,
} from '../settings/SettingsSchema.js';

import AfkTracker from './Classes/AfkTracker.js';
import { AfkCommand, AfkGroups, AfkModSub, AfkOption } from './Enums.js';
import InteractionCreate from './Events/InteractionCreate/index.js';
import MessageCreate from './Events/MessageCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };
import { prefixAdvert } from './Util/prefixAdvert.js';

type Events = GatewayDispatchEvents.MessageCreate | GatewayDispatchEvents.InteractionCreate;
type AFKLanguage = typeof en;
type AFKTranslator = TranslatorType<AFKLanguage> & { base: BaseLang };

const maxLettersTransform: FieldTransform = async (value) =>
 Number.isInteger(value) && Number(value) > 0
  ? { value }
  : { error: en.settings.errors.maxLetters };

export default class AFKPlugin extends Plugin<Events, AFKLanguage> {
 name = 'AFK';
 settingName = PluginName.Afk;
 dependencies = [PluginName.Settings];
 tableName = 'AFKSetting';

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.ManageNicknames;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {
  [GatewayDispatchEvents.MessageCreate]: (
   data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
  ) => {
   this.logger.debug(`[Plugin:${this.name}] MessageCreate event received`);
   if (!this.isEnabled()) return;
   this.logger.debug(`[Plugin:${this.name}] Processing MessageCreate event`);
   MessageCreate.call(this, data);
  },

  [GatewayDispatchEvents.InteractionCreate]: (
   data: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
  ) => {
   this.logger.debug(`[Plugin:${this.name}] InteractionCreate event received`);
   if (!this.isEnabled()) return;
   this.logger.debug(`[Plugin:${this.name}] Processing InteractionCreate event`);
   InteractionCreate.call(this, data);
  },
 };

 constructor(client: Client) {
  super(client);

  this.pluginBotKey = PluginBotKey.Afk;
 }

 tracker = new AfkTracker(this);

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName(AfkCommand.Afk)
    .setDescription('Set your AFK Status')
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .addStringOption(
     new SlashCommandStringOption()
      .setName(AfkOption.Reason)
      .setDescription('The Reason for being AFK')
      .setRequired(false),
    ),
  ],
  mod: [
   new SlashCommandSubcommandGroupBuilder()
    .setName(AfkCommand.Afk)
    .setDescription('Manage AFK statuses')
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(AfkModSub.List)
      .setDescription('List the members who are AFK')
      .addIntegerOption(
       new SlashCommandIntegerOption()
        .setName(AfkOption.Page)
        .setDescription('The page to show')
        .setMinValue(1)
        .setRequired(false),
      ),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(AfkModSub.Clear)
      .setDescription("Force delete someone's AFK status")
      .addUserOption(
       new SlashCommandUserOption().setName(AfkOption.User).setDescription('The User').setRequired(true),
      )
      .addStringOption(
       new SlashCommandStringOption()
        .setName(AfkOption.Reason)
        .setDescription('The Reason')
        .setRequired(false),
      ),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(AfkModSub.ResetReason)
      .setDescription("Clear someone's AFK reason and keep them AFK")
      .addUserOption(
       new SlashCommandUserOption().setName(AfkOption.User).setDescription('The User').setRequired(true),
      ),
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

 settingsSchema = {
  table: 'afkSetting',
  rowKey: 'id',
  multiRow: false,
  title: (t: AFKTranslator) => t.settings.name(),
  overviewDescription: (t: AFKTranslator) => t.settings.desc(),
  rowLabel: (t: AFKTranslator) => t.settings.name(),
  groups: [
   {
    id: AfkGroups.General,
    label: (t: AFKTranslator) => t.settings.name(),
    fields: [
     {
      column: 'maxLetters',
      editor: EditorType.Number,
      transform: maxLettersTransform,
      label: (t: AFKTranslator) => t.settings.fields.maxLetters.name(),
      description: (t: AFKTranslator) => t.settings.fields.maxLetters.desc(),
     },
     {
      column: 'prefix',
      editor: EditorType.String,
      label: (t: AFKTranslator) => t.settings.fields.prefix.name(),
      description: (t: AFKTranslator) => t.settings.fields.prefix.desc(),
      virtual: prefixAdvert,
     },
     {
      column: 'ignoredChannels',
      editor: EditorType.Channels,
      arity: FieldArity.Multi,
      label: (t: AFKTranslator) => t.settings.fields.ignoredChannels.name(),
      description: (t: AFKTranslator) => t.settings.fields.ignoredChannels.desc(),
     },
    ],
   },
  ],
 } satisfies SettingsSchemaDef<AfkSetting, AFKTranslator> as unknown as SettingsSchemaDef;
}
