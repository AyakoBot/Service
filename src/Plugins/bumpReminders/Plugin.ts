import type { BumpReminderSetting } from '@ayako/database';
import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { ChannelType, PermissionFlagsBits, type GatewayDispatchEvents } from '@discordjs/core';

import Plugin, {
 PluginName,
 SettingsCategory,
 type BaseLang,
} from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import { EmoteName } from '../../Classes/EmoteName.js';
import { formatDurationSeconds } from '../../Util/durationSeconds.js';
import { PluginBotKey } from '../../Util/pluginBotKey.js';
import type { TranslatorType } from '../../Util/translator.js';
import { EditorType } from '../settings/Plugin.js';
import {
 assertSchemaValid,
 FieldArity,
 type SettingsSchemaDef,
} from '../settings/SettingsSchema.js';

import Bumps from './Classes/Bumps.js';
import { providerName } from './Classes/Providers.js';
import {
 commandNameTransform,
 cooldownIsSane,
 matchSourceOptions,
 requiredWhileActive,
 templateOptions,
 templateVirtual,
} from './Classes/settingsFields.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.MessageCreate | GatewayDispatchEvents.InteractionCreate;

type BumpRemindersLanguage = typeof en;
export type BumpRemindersTranslator = TranslatorType<BumpRemindersLanguage> & { base: BaseLang };

export enum BumpRemindersGroups {
 Detection = 'detection',
 General = 'general',
 Pings = 'pings',
 Repeat = 'repeat',
}

export enum BumpRemindersSettingName {
 Bump = 'bump-reminders',
}

export default class BumpRemindersPlugin extends Plugin<Events, BumpRemindersLanguage> {
 name = 'Bump Reminders';
 settingName = PluginName.BumpReminders;
 dependencies = [PluginName.Settings];
 tableName = 'BumpReminderSetting';

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.AddReactions |
  PermissionFlagsBits.ManageMessages;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };

 eventHandlers = {
  MESSAGE_CREATE: (data) => {
   if (!this.isLiveFor(data.guild_id ?? '')) return;
   if (!this.isEnabled()) return;

   messageCreate.call(this, data);
  },
  INTERACTION_CREATE: (data) => {
   if (!this.isLiveFor(data.guild_id ?? '')) return;
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
 } as Plugin<Events, BumpRemindersLanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 bumps = new Bumps(this);

 constructor(client: Client) {
  super(client);

  this.pluginBotKey = PluginBotKey.BumpReminders;
  assertSchemaValid(this.settingsSchema);

  this.client.cache.on('scheduleExpired', (key: unknown) =>
   this.bumps.onScheduleExpired(String(key)),
  );
  this.bumps.reconcile().catch((e: Error) => this.nonFatalError(e, 'reconcileSchedules'));
 }

 onGuildRemoved = async (guildId: string) => {
  await this.client.db.client.bumpReminderSetting.deleteMany({ where: { guild: guildId } });
 };

 getCommands = () => ({
  commands: [],
  settings: [
   {
    category: SettingsCategory.Automation,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName(PluginName.BumpReminders)
      .setDescription('Configure bump reminders'),
     new SlashCommandSubcommandBuilder()
      .setName(BumpRemindersSettingName.Bump)
      .setDescription('Configure bump reminders'),
    ],
   },
  ],
 });

 settingsSchema = {
  table: 'bumpReminderSetting',
  rowKey: 'id',
  multiRow: true,
  title: (t: BumpRemindersTranslator) => t.settings.configTitle(),
  overviewDescription: (t: BumpRemindersTranslator) => t.settings.overviewDescription(),
  rowLabel: (t: BumpRemindersTranslator, row: BumpReminderSetting) =>
   providerName(row, t.settings.newRow()),
  rowSummary: (t: BumpRemindersTranslator, row: BumpReminderSetting) =>
   t.settings.rowSummary({
    status: row.active ? t.base.t.Active() : t.base.t.Disabled(),
    cooldown: formatDurationSeconds(Number(row.cooldownSeconds)) || '?',
   }),
  canDelete: async (row: BumpReminderSetting) =>
   (row.active ? { ok: false, reason: en.settings.deleteBlocked } : { ok: true }),
  groups: [
   {
    id: BumpRemindersGroups.Detection,
    label: (t: BumpRemindersTranslator) => t.settings.groups.detection(),
    emote: EmoteName.Bot,
    fields: [
     {
      column: 'template',
      editor: EditorType.BumpTemplate,
      arity: FieldArity.Single,
      options: templateOptions,
      virtual: templateVirtual,
      label: (t: BumpRemindersTranslator) => t.settings.fields.template(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.template(),
     },
     {
      column: 'botId',
      editor: EditorType.User,
      required: true,
      validate: requiredWhileActive(en.errors.botRequired),
      label: (t: BumpRemindersTranslator) => t.settings.fields.botId(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.botId(),
     },
     {
      column: 'cooldownSeconds',
      editor: EditorType.Duration,
      required: true,
      validate: cooldownIsSane,
      label: (t: BumpRemindersTranslator) => t.settings.fields.cooldownSeconds(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.cooldownSeconds(),
     },
     {
      column: 'matchSource',
      editor: EditorType.BumpMatchSource,
      arity: FieldArity.Single,
      options: matchSourceOptions,
      label: (t: BumpRemindersTranslator) => t.settings.fields.matchSource(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.matchSource(),
     },
     {
      column: 'matchText',
      editor: EditorType.String,
      required: true,
      validate: requiredWhileActive(en.errors.matchRequired),
      label: (t: BumpRemindersTranslator) => t.settings.fields.matchText(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.matchText(),
     },
     {
      column: 'commandName',
      editor: EditorType.String,
      transform: commandNameTransform,
      label: (t: BumpRemindersTranslator) => t.settings.fields.commandName(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.commandName(),
     },
     {
      column: 'commandId',
      editor: EditorType.String,
      label: (t: BumpRemindersTranslator) => t.settings.fields.commandId(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.commandId(),
      showIf: (row) => ({
       ok: Boolean(row.commandName?.length),
       reason: en.settings.reasons.commandIdNeedsName,
      }),
     },
    ],
   },
   {
    id: BumpRemindersGroups.General,
    label: (t: BumpRemindersTranslator) => t.settings.groups.general(),
    emote: EmoteName.Bell,
    fields: [
     {
      column: 'active',
      editor: EditorType.Boolean,
      headerToggle: true,
      label: (t: BumpRemindersTranslator) => t.settings.fields.active(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.active(),
     },
     {
      column: 'name',
      editor: EditorType.String,
      label: (t: BumpRemindersTranslator) => t.settings.fields.name(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.name(),
     },
     {
      column: 'channel',
      editor: EditorType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      label: (t: BumpRemindersTranslator) => t.settings.fields.channel(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.channel(),
     },
     {
      column: 'deleteReply',
      editor: EditorType.Boolean,
      label: (t: BumpRemindersTranslator) => t.settings.fields.deleteReply(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.deleteReply(),
     },
    ],
   },
   {
    id: BumpRemindersGroups.Pings,
    label: (t: BumpRemindersTranslator) => t.settings.groups.pings(),
    emote: EmoteName.Send,
    fields: [
     {
      column: 'roles',
      editor: EditorType.Roles,
      arity: FieldArity.Multi,
      label: (t: BumpRemindersTranslator) => t.settings.fields.roles(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.roles(),
     },
     {
      column: 'users',
      editor: EditorType.Users,
      arity: FieldArity.Multi,
      label: (t: BumpRemindersTranslator) => t.settings.fields.users(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.users(),
     },
    ],
   },
   {
    id: BumpRemindersGroups.Repeat,
    label: (t: BumpRemindersTranslator) => t.settings.groups.repeat(),
    emote: EmoteName.Refresh,
    fields: [
     {
      column: 'repeatEnabled',
      editor: EditorType.Boolean,
      label: (t: BumpRemindersTranslator) => t.settings.fields.repeatEnabled(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.repeatEnabled(),
     },
     {
      column: 'repeatReminder',
      editor: EditorType.Duration,
      validate: cooldownIsSane,
      label: (t: BumpRemindersTranslator) => t.settings.fields.repeatReminder(),
      description: (t: BumpRemindersTranslator) => t.settings.descriptions.repeatReminder(),
      showIf: (row) => ({ ok: row.repeatEnabled, reason: en.settings.reasons.repeatOnly }),
     },
    ],
   },
  ],
  guide: {
   title: (t: BumpRemindersTranslator) => t.guide.title(),
   intro: (t: BumpRemindersTranslator) => t.guide.intro(),
   advert: {
    text: (t: BumpRemindersTranslator) => t.guide.advertText(),
    buttonLabel: (t: BumpRemindersTranslator) => t.guide.advertButton(),
    emote: EmoteName.Timer,
   },
   sections: [
    {
     id: BumpRemindersGroups.Detection,
     label: (t: BumpRemindersTranslator) => t.settings.groups.detection(),
     emote: EmoteName.Bot,
     steps: [
      {
       column: 'botId',
       label: (t: BumpRemindersTranslator) => t.settings.fields.botId(),
       required: true,
      },
      {
       column: 'matchText',
       label: (t: BumpRemindersTranslator) => t.settings.fields.matchText(),
       required: true,
      },
      {
       column: 'cooldownSeconds',
       label: (t: BumpRemindersTranslator) => t.settings.fields.cooldownSeconds(),
       required: true,
      },
     ],
    },
    {
     id: BumpRemindersGroups.General,
     label: (t: BumpRemindersTranslator) => t.settings.groups.general(),
     emote: EmoteName.Bell,
     steps: [
      {
       column: 'roles',
       label: (t: BumpRemindersTranslator) => t.settings.fields.roles(),
      },
      {
       column: 'channel',
       label: (t: BumpRemindersTranslator) => t.settings.fields.channel(),
      },
      {
       column: 'active',
       label: (t: BumpRemindersTranslator) => t.guide.enable(),
       required: true,
      },
     ],
    },
   ],
  },
 } satisfies SettingsSchemaDef<
  BumpReminderSetting,
  BumpRemindersTranslator
 > as unknown as SettingsSchemaDef;

 extraSchemas = { [BumpRemindersSettingName.Bump]: this.settingsSchema };
}
