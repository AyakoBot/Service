import type { TicketSetting } from '@ayako/database';
import { TicketLogMode, TicketType } from '@ayako/database';
import { LogLevel } from '@ayako/utility';
import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { type GatewayDispatchEvents } from '@discordjs/core';

import Plugin, {
 idSelector,
 SettingsCategory,
 type BaseLang,
} from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import emotes from '../../Classes/Emotes.js';
import type { TranslatorType } from '../../Util/translator.js';
import { EditorType } from '../settings/Plugin.js';
import {
 assertSchemaValid,
 FieldArity,
 type SettingsSchemaDef,
} from '../settings/SettingsSchema.js';

import channelDelete from './Events/ChannelDelete/index.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';
import messageDelete from './Events/MessageDelete/index.js';
import messageUpdate from './Events/MessageUpdate/index.js';
import threadDelete from './Events/ThreadDelete/index.js';
import threadUpdate from './Events/ThreadUpdate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events =
 | GatewayDispatchEvents.InteractionCreate
 | GatewayDispatchEvents.MessageCreate
 | GatewayDispatchEvents.MessageUpdate
 | GatewayDispatchEvents.MessageDelete
 | GatewayDispatchEvents.ThreadUpdate
 | GatewayDispatchEvents.ChannelDelete
 | GatewayDispatchEvents.ThreadDelete;
type APILanguage = typeof en;
type TicketTranslator = TranslatorType<APILanguage> & { base: BaseLang };

export enum TicketGroups {
 General = 'general',
 Channels = 'channels',
 Staff = 'staff',
 Notifications = 'notifications',
 Dm = 'dm',
 Forum = 'forum',
}

export default class TicketPlugin extends Plugin<Events, APILanguage> {
 name = 'Ticketing';
 settingName = 'ticketing';
 tableName = 'TicketSetting';

 groupEmotes = {
  [TicketGroups.Channels]: emotes.channelTypes[0],
  [TicketGroups.Staff]: emotes.Member,
  [TicketGroups.Notifications]: emotes.info,
  [TicketGroups.Dm]: emotes.Message,
  [TicketGroups.Forum]: emotes.channelTypes[15],
 };

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };

 eventHandlers = {
  MESSAGE_DELETE: (data) => {
   if (
    !data.guild_id
     ? !this.client.debugUsers.includes(data.channel_id || '')
     : !this.client.debugGuilds.includes(data.guild_id || '')
   ) {
    return; // TODO: remove
   }
   if (!this.isEnabled()) return;

   messageDelete.call(this, data);
  },
  MESSAGE_UPDATE: (data) => {
   if (
    !data.guild_id
     ? !this.client.debugUsers.includes(data.author?.id || '')
     : !this.client.debugGuilds.includes(data.guild_id || '')
   ) {
    return; // TODO: remove
   }
   if (!this.isEnabled()) return;

   messageUpdate.call(this, data);
  },
  MESSAGE_CREATE: (data) => {
   if (
    !data.guild_id
     ? !this.client.debugUsers.includes(data.author.id || '')
     : !this.client.debugGuilds.includes(data.guild_id || '')
   ) {
    return; // TODO: remove
   }

   if (!this.isEnabled()) return;

   messageCreate.call(this, data);
  },
  INTERACTION_CREATE: (data) => {
   if (
    !data.guild_id
     ? !this.client.debugUsers.includes(data.user?.id || '')
     : !this.client.debugGuilds.includes(data.guild_id || '')
   ) {
    return; // TODO: remove
   }
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
  THREAD_UPDATE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) {
    return; // TODO: remove
   }
   if (!this.isEnabled()) return;

   threadUpdate.call(this, data);
  },
  CHANNEL_DELETE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) {
    return; // TODO: remove
   }
   if (!this.isEnabled()) return;

   channelDelete.call(this, data);
  },
  THREAD_DELETE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) {
    return; // TODO: remove
   }
   if (!this.isEnabled()) return;

   threadDelete.call(this, data);
  },
 } as Plugin<Events, APILanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 constructor(client: Client) {
  super(client);

  this.logger.setLevel(LogLevel.silly);
  assertSchemaValid(this.settingsSchema);
 }

 getCommands = () => ({
  commands: [],
  settings: [
   {
    category: SettingsCategory.Automation,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName('ticketing')
      .setDescription('Create a Ticket System for your Server')
      .addStringOption(idSelector),
    ],
   },
  ],
 });

 settingsSchema = {
  table: 'ticketSetting',
  rowKey: 'id',
  multiRow: true,
  rowLabel: (t: TicketTranslator, row: TicketSetting) =>
   t.settings.systemLabel({ id: String(row.id) }),
  groups: [
   {
    id: TicketGroups.General,
    label: (t: TicketTranslator) => t.settings.groups.general(),
    fields: [
     {
      column: 'active',
      editor: EditorType.Boolean,
      label: (t: TicketTranslator) => t.base.t.Active(),
      headerToggle: true,
     },
     {
      column: 'type',
      editor: EditorType.TicketType,
      label: (t: TicketTranslator) => t.settings.fields.type(),
      description: (t: TicketTranslator) => t.settings.descriptions.type(),
      arity: FieldArity.Single,
      required: true,
      options: [
       { value: TicketType.Channel, label: (t: TicketTranslator) => t.base.t.Channel() },
       { value: TicketType.Thread, label: (t: TicketTranslator) => t.base.t.Thread() },
       {
        value: TicketType.dmToChannel,
        label: (t: TicketTranslator) => t.settings.options.dmToChannel(),
       },
       {
        value: TicketType.dmToThread,
        label: (t: TicketTranslator) => t.settings.options.dmToThread(),
       },
      ],
     },
     {
      column: 'logMode',
      editor: EditorType.TicketLogMode,
      label: (t: TicketTranslator) => t.settings.fields.logMode(),
      description: (t: TicketTranslator) => t.settings.descriptions.logMode(),
      arity: FieldArity.Single,
      options: [
       { value: TicketLogMode.Channel, label: (t: TicketTranslator) => t.base.t.Channel() },
       { value: TicketLogMode.Thread, label: (t: TicketTranslator) => t.base.t.Thread() },
      ],
     },
     {
      column: 'allowCreatorClose',
      editor: EditorType.Boolean,
      label: (t: TicketTranslator) => t.settings.fields.allowCreatorClose(),
      description: (t: TicketTranslator) => t.settings.descriptions.allowCreatorClose(),
     },
    ],
   },
   {
    id: TicketGroups.Channels,
    label: (t: TicketTranslator) => t.settings.groups.channels(),
    fields: [
     {
      column: 'category',
      editor: EditorType.Category,
      label: (t: TicketTranslator) => t.settings.fields.category(),
      description: (t: TicketTranslator) => t.settings.descriptions.category(),
      showIf: (row) => ({
       ok: [TicketType.Channel, TicketType.dmToChannel].includes(row.type),
       reason: en.settings.reasons.channelTypeOnly,
      }),
     },
     {
      column: 'channel',
      editor: EditorType.Channel,
      label: (t: TicketTranslator) => t.settings.fields.channel(),
      description: (t: TicketTranslator) => t.settings.descriptions.channel(),
      showIf: (row) => ({
       ok: [TicketType.Thread, TicketType.dmToThread].includes(row.type),
       reason: en.settings.reasons.threadTypeOnly,
      }),
     },
     {
      column: 'archiveCategory',
      editor: EditorType.Category,
      label: (t: TicketTranslator) => t.settings.fields.archiveCategory(),
      description: (t: TicketTranslator) => t.settings.descriptions.archiveCategory(),
      showIf: (row) => ({
       ok: [TicketType.Channel, TicketType.dmToChannel].includes(row.type),
       reason: en.settings.reasons.channelTypeOnly,
      }),
     },
     {
      column: 'archiveDuration',
      editor: EditorType.Duration,
      label: (t: TicketTranslator) => t.settings.fields.archiveDuration(),
      description: (t: TicketTranslator) => t.settings.descriptions.archiveDuration(),
      arity: FieldArity.Single,
      options: [
       { value: '3600000', label: (t: TicketTranslator) => t.settings.durations['1h']() },
       { value: '43200000', label: (t: TicketTranslator) => t.settings.durations['12h']() },
       { value: '86400000', label: (t: TicketTranslator) => t.settings.durations['24h']() },
       { value: '259200000', label: (t: TicketTranslator) => t.settings.durations['3d']() },
       { value: '604800000', label: (t: TicketTranslator) => t.settings.durations['1w']() },
      ],
     },
     {
      column: 'logChannels',
      editor: EditorType.Channels,
      label: (t: TicketTranslator) => t.settings.fields.logChannels(),
      description: (t: TicketTranslator) => t.settings.descriptions.logChannels(),
      arity: FieldArity.Multi,
     },
    ],
   },
   {
    id: TicketGroups.Staff,
    label: (t: TicketTranslator) => t.settings.groups.staff(),
    fields: [
     {
      column: 'staffRoles',
      editor: EditorType.Roles,
      label: (t: TicketTranslator) => t.settings.fields.staffRoles(),
      description: (t: TicketTranslator) => t.settings.descriptions.staffRoles(),
      arity: FieldArity.Multi,
     },
     {
      column: 'staffUsers',
      editor: EditorType.Users,
      label: (t: TicketTranslator) => t.settings.fields.staffUsers(),
      description: (t: TicketTranslator) => t.settings.descriptions.staffUsers(),
      arity: FieldArity.Multi,
     },
     {
      column: 'staffThreads',
      editor: EditorType.Boolean,
      label: (t: TicketTranslator) => t.settings.fields.staffThreads(),
      description: (t: TicketTranslator) => t.settings.descriptions.staffThreads(),
      showIf: (row) => ({
       ok: [TicketType.Channel, TicketType.Thread].includes(row.type),
       reason: en.settings.reasons.nonDmOnly,
      }),
     },
     {
      column: 'staffThreadsChannel',
      editor: EditorType.Channel,
      label: (t: TicketTranslator) => t.settings.fields.staffThreadsChannel(),
      description: (t: TicketTranslator) => t.settings.descriptions.staffThreadsChannel(),
      showIf: (row) => ({
       ok: Boolean(row.staffThreads),
       reason: en.settings.reasons.staffThreadsOff,
      }),
     },
    ],
   },
   {
    id: TicketGroups.Notifications,
    label: (t: TicketTranslator) => t.settings.groups.notifications(),
    fields: [
     {
      column: 'mentionRoles',
      editor: EditorType.Roles,
      label: (t: TicketTranslator) => t.settings.fields.mentionRoles(),
      description: (t: TicketTranslator) => t.settings.descriptions.mentionRoles(),
      arity: FieldArity.Multi,
     },
     {
      column: 'mentionUsers',
      editor: EditorType.Users,
      label: (t: TicketTranslator) => t.settings.fields.mentionUsers(),
      description: (t: TicketTranslator) => t.settings.descriptions.mentionUsers(),
      arity: FieldArity.Multi,
     },
     {
      column: 'denyRoles',
      editor: EditorType.Roles,
      label: (t: TicketTranslator) => t.settings.fields.denyRoles(),
      description: (t: TicketTranslator) => t.settings.descriptions.denyRoles(),
      arity: FieldArity.Multi,
     },
     {
      column: 'denyUsers',
      editor: EditorType.Users,
      label: (t: TicketTranslator) => t.settings.fields.denyUsers(),
      description: (t: TicketTranslator) => t.settings.descriptions.denyUsers(),
      arity: FieldArity.Multi,
     },
    ],
   },
   {
    id: TicketGroups.Dm,
    label: (t: TicketTranslator) => t.settings.groups.dm(),
    showIf: (row) => ({
     ok: [TicketType.dmToThread, TicketType.dmToChannel].includes(row.type),
     reason: en.settings.reasons.dmOnly,
    }),
    fields: [
     {
      column: 'sendMessagePrefixes',
      editor: EditorType.Strings,
      label: (t: TicketTranslator) => t.settings.fields.sendMessagePrefixes(),
      description: (t: TicketTranslator) => t.settings.descriptions.sendMessagePrefixes(),
      arity: FieldArity.Multi,
     },
    ],
   },
   {
    id: TicketGroups.Forum,
    label: (t: TicketTranslator) => t.settings.groups.forum(),
    fields: [
     {
      column: 'createTags',
      editor: EditorType.Strings,
      label: (t: TicketTranslator) => t.settings.fields.createTags(),
      description: (t: TicketTranslator) => t.settings.descriptions.createTags(),
      arity: FieldArity.Multi,
     },
     {
      column: 'claimTags',
      editor: EditorType.Strings,
      label: (t: TicketTranslator) => t.settings.fields.claimTags(),
      description: (t: TicketTranslator) => t.settings.descriptions.claimTags(),
      arity: FieldArity.Multi,
     },
     {
      column: 'closeTags',
      editor: EditorType.Strings,
      label: (t: TicketTranslator) => t.settings.fields.closeTags(),
      description: (t: TicketTranslator) => t.settings.descriptions.closeTags(),
      arity: FieldArity.Multi,
     },
     {
      column: 'tagClaimer',
      editor: EditorType.Boolean,
      label: (t: TicketTranslator) => t.settings.fields.tagClaimer(),
      description: (t: TicketTranslator) => t.settings.descriptions.tagClaimer(),
     },
     {
      column: 'transcriptChannels',
      editor: EditorType.Channels,
      label: (t: TicketTranslator) => t.settings.fields.transcriptChannels(),
      description: (t: TicketTranslator) => t.settings.descriptions.transcriptChannels(),
      arity: FieldArity.Multi,
     },
    ],
   },
  ],
 } satisfies SettingsSchemaDef<TicketSetting, TicketTranslator> as SettingsSchemaDef;
}
