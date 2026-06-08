import type { Snippets, TicketSetting } from '@ayako/database';
import { TicketLogMode, TicketPlacementMode, TicketState, TicketType } from '@ayako/database';
import { LogLevel } from '@ayako/utility';
import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
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
import TicketReminders from './Reminders/TicketReminders.js';
import { botTokenTransform } from './Util/botTokenTransform.js';

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
 Panel = 'panel',
 Forum = 'forum',
 Reminders = 'reminders',
 Inactivity = 'inactivity',
 RemindTargets = 'remindTargets',
 BotIdentity = 'botIdentity',
 Escalation = 'escalation',
 Limits = 'limits',
}

export default class TicketPlugin extends Plugin<Events, APILanguage> {
 name = 'Ticketing';
 settingName = 'ticketing';
 tableName = 'TicketSetting';

 reminders: TicketReminders;

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

  this.pluginBotToken = process.env.TICKET_TOKEN;

  this.logger.setLevel(LogLevel.silly);
  assertSchemaValid(this.settingsSchema);

  this.reminders = new TicketReminders(this);
  this.client.cache.on('scheduleExpired', (key: unknown) =>
   this.reminders.onScheduleExpired(String(key)),
  );
  this.reminders.reconcile().catch((e: Error) => this.nonFatalError(e, 'reconcileSchedules'));
 }

 invalidateToken = async (cipher: string): Promise<void> => {
  await this.client.db.client.ticketSetting.updateMany({
   where: { botToken: cipher },
   data: { botToken: null },
  });
 };

 onGuildRemoved = async (guildId: string) => {
  await this.client.db.client.ticketSetting.updateMany({
   where: { guild: guildId },
   data: { botToken: null },
  });
  this.invalidateGuildAPI(guildId);
 };

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Post a saved snippet into the current ticket, or open the snippet toolkit')
    .addStringOption((option) =>
     option
      .setName('tag')
      .setDescription('The snippet to post')
      .setRequired(false)
      .setAutocomplete(true),
    ),
  ],
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
  title: (t: TicketTranslator) => t.settings.configTitle(),
  rowLabel: (t: TicketTranslator, row: TicketSetting) =>
   t.settings.systemLabel({ id: String(row.id) }),
  overviewDescription: (t: TicketTranslator) => t.settings.overviewDescription(),
  rowSummary: (t: TicketTranslator, row: TicketSetting) => {
   const typeLabels: Record<TicketType, string> = {
    [TicketType.Channel]: t.base.t.Channel(),
    [TicketType.Thread]: t.base.t.Thread(),
    [TicketType.dmToChannel]: t.settings.options.dmToChannel(),
    [TicketType.dmToThread]: t.settings.options.dmToThread(),
   };
   const status = row.active ? t.base.t.Active() : t.base.t.Disabled();
   const panel = row.panelChannel
    ? t.settings.panelIn({ channel: `<#${row.panelChannel}>` })
    : t.settings.noPanel();
   return t.settings.systemSummary({ type: typeLabels[row.type], status, panel });
  },
  canDelete: async (row, ctx) => {
   const open = await ctx.client.db.client.ticket.findMany({
    where: {
     settingsId: String(row.id),
     state: { in: [TicketState.opened, TicketState.claimed] },
    },
   });
   if (!open.length) return { ok: true };

   const t = (await ctx.plugin.t(ctx.guildId)) as unknown as TicketTranslator;
   return { ok: false, reason: t.settings.deleteBlocked({ count: String(open.length) }) };
  },
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
    emote: emotes.channelTypes[0],
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
    emote: emotes.Member,
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
    emote: emotes.info,
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
    emote: emotes.Message,
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
    id: TicketGroups.Panel,
    label: (t: TicketTranslator) => t.settings.groups.panel(),
    emote: emotes.Message,
    fields: [
     {
      column: 'dmEnabled',
      editor: EditorType.Boolean,
      label: (t: TicketTranslator) => t.settings.fields.dmEnabled(),
      description: (t: TicketTranslator) => t.settings.descriptions.dmEnabled(),
     },
     {
      column: 'panelChannel',
      editor: EditorType.Channel,
      label: (t: TicketTranslator) => t.settings.fields.panelChannel(),
      description: (t: TicketTranslator) => t.settings.descriptions.panelChannel(),
     },
     {
      column: 'panelButtonLabel',
      editor: EditorType.String,
      label: (t: TicketTranslator) => t.settings.fields.panelButtonLabel(),
      description: (t: TicketTranslator) => t.settings.descriptions.panelButtonLabel(),
      arity: FieldArity.Single,
      showIf: (row) => ({
       ok: Boolean(row.panelChannel),
       reason: en.settings.reasons.panelChannelOff,
      }),
     },
    ],
   },
   {
    id: TicketGroups.Forum,
    label: (t: TicketTranslator) => t.settings.groups.forum(),
    emote: emotes.channelTypes[15],
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
   {
    id: TicketGroups.Reminders,
    label: (t: TicketTranslator) => t.settings.groups.reminders(),
    emote: emotes.timer,
    fields: [
     {
      column: 'remindUnclaimedAfter',
      editor: EditorType.Duration,
      label: (t: TicketTranslator) => t.settings.fields.remindUnclaimedAfter(),
      description: (t: TicketTranslator) => t.settings.descriptions.remindUnclaimedAfter(),
      arity: FieldArity.Single,
     },
     {
      column: 'remindUnclaimedEvery',
      editor: EditorType.Duration,
      label: (t: TicketTranslator) => t.settings.fields.remindUnclaimedEvery(),
      description: (t: TicketTranslator) => t.settings.descriptions.remindUnclaimedEvery(),
      arity: FieldArity.Single,
     },
     {
      column: 'remindStaleAfter',
      editor: EditorType.Duration,
      label: (t: TicketTranslator) => t.settings.fields.remindStaleAfter(),
      description: (t: TicketTranslator) => t.settings.descriptions.remindStaleAfter(),
      arity: FieldArity.Single,
     },
     {
      column: 'remindStaleEvery',
      editor: EditorType.Duration,
      label: (t: TicketTranslator) => t.settings.fields.remindStaleEvery(),
      description: (t: TicketTranslator) => t.settings.descriptions.remindStaleEvery(),
      arity: FieldArity.Single,
     },
    ],
   },
   {
    id: TicketGroups.Inactivity,
    label: (t: TicketTranslator) => t.settings.groups.inactivity(),
    emote: emotes.timer,
    fields: [
     {
      column: 'inactivityWarnAfter',
      editor: EditorType.Duration,
      label: (t: TicketTranslator) => t.settings.fields.inactivityWarnAfter(),
      description: (t: TicketTranslator) => t.settings.descriptions.inactivityWarnAfter(),
      arity: FieldArity.Single,
     },
     {
      column: 'inactivityCloseAfter',
      editor: EditorType.Duration,
      label: (t: TicketTranslator) => t.settings.fields.inactivityCloseAfter(),
      description: (t: TicketTranslator) => t.settings.descriptions.inactivityCloseAfter(),
      arity: FieldArity.Single,
     },
    ],
   },
   {
    id: TicketGroups.RemindTargets,
    label: (t: TicketTranslator) => t.settings.groups.remindTargets(),
    emote: emotes.Member,
    fields: [
     {
      column: 'remindRoles',
      editor: EditorType.Roles,
      label: (t: TicketTranslator) => t.settings.fields.remindRoles(),
      description: (t: TicketTranslator) => t.settings.descriptions.remindRoles(),
      arity: FieldArity.Multi,
     },
     {
      column: 'remindUsers',
      editor: EditorType.Users,
      label: (t: TicketTranslator) => t.settings.fields.remindUsers(),
      description: (t: TicketTranslator) => t.settings.descriptions.remindUsers(),
      arity: FieldArity.Multi,
     },
    ],
   },
   {
    id: TicketGroups.BotIdentity,
    label: (t: TicketTranslator) => t.settings.groups.botIdentity(),
    emote: emotes.lock,
    fields: [
     {
      column: 'botToken',
      editor: EditorType.BotToken,
      label: (t: TicketTranslator) => t.settings.fields.botToken(),
      description: (t: TicketTranslator) => t.settings.descriptions.botToken(),
      arity: FieldArity.Single,
      secret: true,
      transform: botTokenTransform,
     },
    ],
   },
   {
    id: TicketGroups.Escalation,
    label: (t: TicketTranslator) => t.settings.groups.escalation(),
    emote: emotes.tools,
    fields: [
     {
      column: 'placementMode',
      editor: EditorType.TicketPlacementMode,
      label: (t: TicketTranslator) => t.settings.fields.placementMode(),
      description: (t: TicketTranslator) => t.settings.descriptions.placementMode(),
      arity: FieldArity.Single,
      options: [
       {
        value: TicketPlacementMode.SeparateSpaces,
        label: (t: TicketTranslator) => t.settings.options.separateSpaces(),
       },
       {
        value: TicketPlacementMode.UnifiedForum,
        label: (t: TicketTranslator) => t.settings.options.unifiedForum(),
       },
      ],
     },
     {
      column: 'forumChannel',
      editor: EditorType.Channel,
      label: (t: TicketTranslator) => t.settings.fields.forumChannel(),
      description: (t: TicketTranslator) => t.settings.descriptions.forumChannel(),
      showIf: (row) => ({
       ok: row.placementMode === TicketPlacementMode.UnifiedForum,
       reason: en.settings.reasons.forumModeOnly,
      }),
     },
    ],
   },
   {
    id: TicketGroups.Limits,
    label: (t: TicketTranslator) => t.settings.groups.limits(),
    emote: emotes.Member,
    fields: [
     {
      column: 'allowTakeClaim',
      editor: EditorType.Boolean,
      label: (t: TicketTranslator) => t.settings.fields.allowTakeClaim(),
      description: (t: TicketTranslator) => t.settings.descriptions.allowTakeClaim(),
     },
     {
      column: 'staffTierRoles',
      editor: EditorType.Roles,
      label: (t: TicketTranslator) => t.settings.fields.staffTierRoles(),
      description: (t: TicketTranslator) => t.settings.descriptions.staffTierRoles(),
      arity: FieldArity.Multi,
      showIf: (row) => ({
       ok: Boolean(row.allowTakeClaim),
       reason: en.settings.reasons.takeClaimOff,
      }),
     },
     {
      column: 'ticketLimitTotal',
      editor: EditorType.Number,
      label: (t: TicketTranslator) => t.settings.fields.ticketLimitTotal(),
      description: (t: TicketTranslator) => t.settings.descriptions.ticketLimitTotal(),
      arity: FieldArity.Single,
     },
     {
      column: 'ticketLimitKind',
      editor: EditorType.Number,
      label: (t: TicketTranslator) => t.settings.fields.ticketLimitKind(),
      description: (t: TicketTranslator) => t.settings.descriptions.ticketLimitKind(),
      arity: FieldArity.Single,
     },
    ],
   },
  ],
 } satisfies SettingsSchemaDef<TicketSetting, TicketTranslator> as SettingsSchemaDef;

 snippetsSchema = {
  table: 'snippets',
  rowKey: 'name',
  multiRow: true,
  rowLabel: (t: TicketTranslator, row: Snippets) => row.name || t.tag.toolkitHeader(),
  groups: [
   {
    id: 'snippet',
    label: (t: TicketTranslator) => t.tag.toolkitHeader(),
    fields: [
     {
      column: 'name',
      editor: EditorType.String,
      label: (t: TicketTranslator) => t.base.t.name(),
      arity: FieldArity.Single,
      required: true,
     },
     {
      column: 'userText',
      editor: EditorType.Message,
      label: (t: TicketTranslator) => t.tag.fields.userText(),
      arity: FieldArity.Single,
     },
     {
      column: 'staffText',
      editor: EditorType.Message,
      label: (t: TicketTranslator) => t.tag.fields.staffText(),
      arity: FieldArity.Single,
     },
     {
      column: 'kinds',
      editor: EditorType.Strings,
      label: (t: TicketTranslator) => t.tag.fields.kinds(),
      arity: FieldArity.Multi,
     },
    ],
   },
  ],
 } satisfies SettingsSchemaDef<Snippets, TicketTranslator> as SettingsSchemaDef;
}
