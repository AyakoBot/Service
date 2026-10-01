import {
 ConfessionAnonymity,
 ConfessionMode,
 type ConfessionSetting,
} from '@ayako/database';
import {
 SlashCommandBuilder,
 SlashCommandSubcommandBuilder,
} from '@discordjs/builders';
import {
 ApplicationIntegrationType,
 ChannelType,
 InteractionContextType,
 PermissionFlagsBits,
 type GatewayDispatchEvents,
} from '@discordjs/core';

import Plugin, {
 PluginName,
 SettingsCategory,
 type BaseLang,
} from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import { EmoteName } from '../../Classes/EmoteName.js';
import type { ButtonAction } from '../../Util/buttonActions.js';
import type { CommandMention } from '../../Util/commandMention.js';
import {
 MessagePlaceholder,
 renderPlaceholderList,
 withServerPlaceholders,
} from '../../Util/messagePlaceholders.js';
import { PluginBotKey } from '../../Util/pluginBotKey.js';
import stp from '../../Util/stp.js';
import { savedDesignField } from '../../Util/savedRef.js';
import type { TranslatorType } from '../../Util/translator.js';
import { EditorType } from '../settings/EditorType.js';
import { FieldArity, assertSchemaValid, type SettingsSchemaDef } from '../settings/SettingsSchema.js';

import ConfessionLogger from './Classes/ConfessionLogger.js';
import ConfessionModeration from './Classes/ConfessionModeration.js';
import ConfessionPublisher from './Classes/ConfessionPublisher.js';
import Confessions from './Classes/Confessions.js';
import ConfessionSchedule from './Classes/ConfessionSchedule.js';
import { bansCommandName, commandName, ConfessionsRoute } from './Classes/Routes.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageDelete from './Events/MessageDelete/index.js';
import messageDeleteBulk from './Events/MessageDeleteBulk/index.js';
import threadDelete from './Events/ThreadDelete/index.js';
import { contentLimit } from './Util/gates.js';
import { LengthColumn, lengthTransform } from './Util/lengthTransform.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events =
 | GatewayDispatchEvents.InteractionCreate
 | GatewayDispatchEvents.MessageDelete
 | GatewayDispatchEvents.MessageDeleteBulk
 | GatewayDispatchEvents.ThreadDelete;

type ConfessionsLanguage = typeof en;
type ConfessionsTranslator = TranslatorType<ConfessionsLanguage> & { base: BaseLang };

export enum ConfessionsGroups {
 General = 'general',
 Appearance = 'appearance',
 Review = 'review',
 Submission = 'submission',
 Media = 'media',
 Access = 'access',
 Cleanup = 'cleanup',
}

const confessionPlaceholders = withServerPlaceholders(
 MessagePlaceholder.Confession,
 MessagePlaceholder.Number,
);
type ConfessionsVirtualColumns = {
 design: string | null;
};

const placeholderList = renderPlaceholderList(confessionPlaceholders);
const confessionAppends = 5;

const anonymityOff = (row: ConfessionSetting) => ({
 ok: row.anonymity === ConfessionAnonymity.Unmaskable,
 reason: en.settings.reasons.anonymousMode,
});

const lengthErrors = {
 range: stp(en.errors.lengthRange, { max: String(contentLimit) }),
 order: en.errors.lengthOrder,
};

export default class ConfessionsPlugin extends Plugin<Events, ConfessionsLanguage> {
 name = 'Confessions';
 settingName = PluginName.Confessions;
 dependencies = [PluginName.Settings];
 tableName = 'ConfessionSetting';
 placeholders = confessionPlaceholders;

 buttonActions: ButtonAction[] = [
  {
   route: ConfessionsRoute.Submit,
   label: async (guildId: string) => (await this.t(guildId)).confession.submitButton(),
  },
 ];

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.CreatePublicThreads |
  PermissionFlagsBits.ManageThreads;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };

 eventHandlers = {
  INTERACTION_CREATE: (data) => {
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
  MESSAGE_DELETE: (data) => {
   if (!this.isEnabled()) return;

   messageDelete.call(this, data);
  },
  MESSAGE_DELETE_BULK: (data) => {
   if (!this.isEnabled()) return;

   messageDeleteBulk.call(this, data);
  },
  THREAD_DELETE: (data) => {
   if (!this.isEnabled()) return;

   threadDelete.call(this, data);
  },
 } as Plugin<Events, ConfessionsLanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 confessions = new Confessions(this);
 publisher = new ConfessionPublisher(this);
 confessionLog = new ConfessionLogger(this);
 moderation = new ConfessionModeration(this);
 schedule = new ConfessionSchedule(this);

 constructor(client: Client) {
  super(client);

  this.pluginBotKey = PluginBotKey.Confessions;

  assertSchemaValid(this.settingsSchema);

  this.client.cache.on('scheduleExpired', (key: unknown) =>
   this.schedule.onScheduleExpired(String(key)),
  );
  this.schedule.reconcile().catch((e: Error) => this.nonFatalError(e, 'reconcileSchedules'));
 }

 onGuildRemoved = async (guildId: string) => {
  await this.client.db.client.confessionSetting.deleteMany({ where: { guild: guildId } });
  await this.client.db.client.confession.deleteMany({ where: { guild: guildId } });
  await this.client.db.client.confessionBan.deleteMany({ where: { guild: guildId } });
 };

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName(commandName)
    .setDescription('Send a confession')
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall]),
   new SlashCommandBuilder()
    .setName(bansCommandName)
    .setDescription('List the confession authors banned on this server')
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  ],
  settings: [
   {
    category: SettingsCategory.Automation,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName(PluginName.Confessions)
      .setDescription('Configure confessions'),
    ],
   },
  ],
 });

 settingsSchema = {
  table: 'confessionSetting',
  rowKey: 'id',
  multiRow: false,
  title: (t: ConfessionsTranslator) => t.settings.configTitle(),
  overviewDescription: (t: ConfessionsTranslator) => t.settings.overviewDescription(),
  rowLabel: (t: ConfessionsTranslator) => t.settings.configTitle(),
  groups: [
   {
    id: ConfessionsGroups.General,
    label: (t: ConfessionsTranslator) => t.settings.groups.general(),
    emote: EmoteName.Message,
    fields: [
     {
      column: 'active',
      editor: EditorType.Boolean,
      headerToggle: true,
      label: (t: ConfessionsTranslator) => t.settings.fields.active(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.active(),
     },
     {
      column: 'channel',
      editor: EditorType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum],
      required: true,
      label: (t: ConfessionsTranslator) => t.settings.fields.channel(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.channel(),
     },
     {
      column: 'autoThread',
      editor: EditorType.Boolean,
      label: (t: ConfessionsTranslator) => t.settings.fields.autoThread(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.autoThread(),
     },
     {
      column: 'mode',
      editor: EditorType.ConfessionMode,
      arity: FieldArity.Single,
      label: (t: ConfessionsTranslator) => t.settings.fields.mode(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.mode(),
      options: [
       {
        value: ConfessionMode.Review,
        label: (t: ConfessionsTranslator) => t.settings.options.modeReview(),
        description: (t: ConfessionsTranslator) => t.settings.options.modeReviewHint(),
       },
       {
        value: ConfessionMode.Screened,
        label: (t: ConfessionsTranslator) => t.settings.options.modeScreened(),
        description: (t: ConfessionsTranslator) => t.settings.options.modeScreenedHint(),
       },
       {
        value: ConfessionMode.Direct,
        label: (t: ConfessionsTranslator) => t.settings.options.modeDirect(),
        description: (t: ConfessionsTranslator) => t.settings.options.modeDirectHint(),
       },
      ],
     },
     {
      column: 'anonymity',
      editor: EditorType.ConfessionAnonymity,
      arity: FieldArity.Single,
      label: (t: ConfessionsTranslator) => t.settings.fields.anonymity(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.anonymity(),
      options: [
       {
        value: ConfessionAnonymity.Unmaskable,
        label: (t: ConfessionsTranslator) => t.settings.options.anonUnmaskable(),
        description: (t: ConfessionsTranslator) => t.settings.options.anonUnmaskableHint(),
       },
       {
        value: ConfessionAnonymity.Anonymous,
        label: (t: ConfessionsTranslator) => t.settings.options.anonAnonymous(),
        description: (t: ConfessionsTranslator) => t.settings.options.anonAnonymousHint(),
       },
      ],
     },
     {
      column: 'numbered',
      editor: EditorType.Boolean,
      label: (t: ConfessionsTranslator) => t.settings.fields.numbered(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.numbered(),
     },
     {
      column: 'logChannel',
      editor: EditorType.Channel,
      channelTypes: [ChannelType.GuildText],
      label: (t: ConfessionsTranslator) => t.settings.fields.logChannel(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.logChannel(),
     },
    ],
   },
   {
    id: ConfessionsGroups.Appearance,
    label: (t: ConfessionsTranslator) => t.settings.groups.appearance(),
    emote: EmoteName.Palette,
    fields: [
     {
      column: 'submitButton',
      editor: EditorType.Boolean,
      label: (t: ConfessionsTranslator) => t.settings.fields.submitButton(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.submitButton(),
     },
     {
      column: 'design',
      editor: EditorType.SavedDesign,
      emote: EmoteName.Message,
      arity: FieldArity.Single,
      label: (t: ConfessionsTranslator) => t.settings.fields.design(),
      description: (t: ConfessionsTranslator) =>
       t.settings.descriptions.design({ list: placeholderList }),
      ...savedDesignField(
       'confessionSetting',
       { embed: 'embed', components: 'components' },
       confessionAppends,
      ),
     },
    ],
   },
   {
    id: ConfessionsGroups.Review,
    label: (t: ConfessionsTranslator) => t.settings.groups.review(),
    emote: EmoteName.Hammer,
    fields: [
     {
      column: 'reviewChannel',
      editor: EditorType.Channel,
      channelTypes: [ChannelType.GuildText],
      required: true,
      label: (t: ConfessionsTranslator) => t.settings.fields.reviewChannel(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.reviewChannel(),
     },
     {
      column: 'reviewerRoles',
      editor: EditorType.Roles,
      arity: FieldArity.Multi,
      label: (t: ConfessionsTranslator) => t.settings.fields.reviewerRoles(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.reviewerRoles(),
     },
    ],
   },
   {
    id: ConfessionsGroups.Submission,
    label: (t: ConfessionsTranslator) => t.settings.groups.submission(),
    emote: EmoteName.Timer,
    fields: [
     {
      column: 'cooldown',
      editor: EditorType.Duration,
      label: (t: ConfessionsTranslator) => t.settings.fields.cooldown(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.cooldown(),
     },
     {
      column: 'minAccountAge',
      editor: EditorType.Duration,
      label: (t: ConfessionsTranslator) => t.settings.fields.minAccountAge(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.minAccountAge(),
     },
     {
      column: 'minMemberAge',
      editor: EditorType.Duration,
      label: (t: ConfessionsTranslator) => t.settings.fields.minMemberAge(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.minMemberAge(),
     },
     {
      column: 'minLength',
      editor: EditorType.Number,
      transform: lengthTransform(LengthColumn.Min, lengthErrors),
      label: (t: ConfessionsTranslator) => t.settings.fields.minLength(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.minLength(),
     },
     {
      column: 'maxLength',
      editor: EditorType.Number,
      transform: lengthTransform(LengthColumn.Max, lengthErrors),
      label: (t: ConfessionsTranslator) => t.settings.fields.maxLength(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.maxLength(),
     },
     {
      column: 'maxPerDay',
      editor: EditorType.Number,
      label: (t: ConfessionsTranslator) => t.settings.fields.maxPerDay(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.maxPerDay(),
     },
    ],
   },
   {
    id: ConfessionsGroups.Media,
    label: (t: ConfessionsTranslator) => t.settings.groups.media(),
    emote: EmoteName.Image,
    fields: [
     {
      column: 'allowMedia',
      editor: EditorType.Boolean,
      showIf: anonymityOff,
      label: (t: ConfessionsTranslator) => t.settings.fields.allowMedia(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.allowMedia(),
     },
    ],
   },
   {
    id: ConfessionsGroups.Access,
    label: (t: ConfessionsTranslator) => t.settings.groups.access(),
    emote: EmoteName.Lock,
    fields: [
     {
      column: 'blockedRoles',
      editor: EditorType.Roles,
      arity: FieldArity.Multi,
      label: (t: ConfessionsTranslator) => t.settings.fields.blockedRoles(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.blockedRoles(),
     },
     {
      column: 'blockedUsers',
      editor: EditorType.Users,
      arity: FieldArity.Multi,
      label: (t: ConfessionsTranslator) => t.settings.fields.blockedUsers(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.blockedUsers(),
     },
    ],
   },
   {
    id: ConfessionsGroups.Cleanup,
    label: (t: ConfessionsTranslator) => t.settings.groups.cleanup(),
    emote: EmoteName.Trash,
    fields: [
     {
      column: 'postJitter',
      editor: EditorType.Duration,
      label: (t: ConfessionsTranslator) => t.settings.fields.postJitter(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.postJitter(),
     },
     {
      column: 'deleteAfter',
      editor: EditorType.Duration,
      label: (t: ConfessionsTranslator) => t.settings.fields.deleteAfter(),
      description: (t: ConfessionsTranslator) => t.settings.descriptions.deleteAfter(),
     },
    ],
   },
  ],
  guide: {
   title: (t: ConfessionsTranslator) => t.guide.title(),
   intro: (t: ConfessionsTranslator, mention: CommandMention) =>
    t.guide.intro({ command: mention(commandName) }),
   advert: {
    text: (t: ConfessionsTranslator) => t.guide.advertText(),
    buttonLabel: (t: ConfessionsTranslator) => t.guide.advertButton(),
    emote: EmoteName.Message,
   },
   sections: [
    {
     id: ConfessionsGroups.General,
     label: (t: ConfessionsTranslator) => t.settings.groups.general(),
     emote: EmoteName.Message,
     steps: [
      {
       column: 'channel',
       label: (t: ConfessionsTranslator) => t.settings.fields.channel(),
       required: true,
      },
      {
       column: 'reviewChannel',
       label: (t: ConfessionsTranslator) => t.settings.fields.reviewChannel(),
       required: true,
      },
      {
       column: 'anonymity',
       label: (t: ConfessionsTranslator) => t.settings.fields.anonymity(),
       required: true,
      },
      {
       column: 'mode',
       label: (t: ConfessionsTranslator) => t.settings.fields.mode(),
      },
      {
       column: 'active',
       label: (t: ConfessionsTranslator) => t.guide.enable(),
       required: true,
      },
     ],
    },
   ],
  },
 } satisfies SettingsSchemaDef<
  ConfessionSetting & ConfessionsVirtualColumns,
  ConfessionsTranslator
 > as unknown as SettingsSchemaDef;
}
