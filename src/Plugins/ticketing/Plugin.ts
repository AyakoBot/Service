import type { Snippets, TicketSetting } from '@ayako/database';
import {
 PresenceActivityType,
 ThreadArchiveDuration,
 TicketLogMode,
 TicketPlacementMode,
 TicketState,
 TicketType,
} from '@ayako/database';
import {
 createRedisWrapper,
 decrypt,
 LogLevel,
 SatelliteChannel,
 type RedisWrapperInterface,
} from '@ayako/utility';
import {
 ContextMenuCommandBuilder,
 SlashCommandBuilder,
 SlashCommandSubcommandBuilder,
} from '@discordjs/builders';
import {
 ApplicationCommandType,
 ChannelType,
 PermissionFlagsBits,
 type GatewayDispatchEvents,
} from '@discordjs/core';

import Plugin, {
 idSelector,
 PluginName,
 SettingsCategory,
 type BaseLang,
} from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import { EmoteName } from '../../Classes/EmoteName.js';
import type { TranslatorType } from '../../Util/translator.js';
import { EditorType } from '../settings/Plugin.js';
import {
 assertSchemaValid,
 FieldArity,
 type SettingsSchemaDef,
} from '../settings/SettingsSchema.js';

import { forceOpenCommandName, tagCommandName, TicketRoute } from './Classes/Routes.js';
import channelDelete from './Events/ChannelDelete/index.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';
import messageDelete from './Events/MessageDelete/index.js';
import messageUpdate from './Events/MessageUpdate/index.js';
import threadDelete from './Events/ThreadDelete/index.js';
import threadUpdate from './Events/ThreadUpdate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };
import TicketReminders from './Reminders/TicketReminders.js';
import { BotProfilePart, botProfileImageTransform, botProfileVirtual } from './Util/botProfile.js';
import { botTokenTransform } from './Util/botTokenTransform.js';
import { presenceEmojiTransform } from './Util/presenceEmojiTransform.js';
import { systemDisplayLabel } from './Util/systemLabel.js';

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
type TicketVirtualColumns = {
 profileNick: string | null;
 profileAvatar: string | null;
 profileBanner: string | null;
};

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
 Presence = 'presence',
 Profile = 'profile',
 Escalation = 'escalation',
 Limits = 'limits',
}

export enum TicketGuideFlag {
 WantsCustomBot = 1 << 0,
 WantsNotifications = 1 << 1,
 WantsReminders = 1 << 2,
 WantsAutoClose = 1 << 3,
 WantsLimits = 1 << 4,
}

export enum TicketGuideSection {
 GoLive = 'goLive',
}

export default class TicketPlugin extends Plugin<Events, APILanguage> {
 name = 'Ticketing';
 settingName = PluginName.Ticketing;
 dependencies = [PluginName.Settings, PluginName.EmbedBuilder, PluginName.ComponentBuilder];
 tableName = 'TicketSetting';

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.ManageThreads |
  PermissionFlagsBits.ManageMessages |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.SendMessagesInThreads |
  PermissionFlagsBits.CreatePublicThreads |
  PermissionFlagsBits.CreatePrivateThreads |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.AddReactions;

 reminders: TicketReminders;
 satellitesControl: RedisWrapperInterface;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };

 eventHandlers = {
  MESSAGE_DELETE: (data) => {
   if (!this.isEnabled()) return;

   messageDelete.call(this, data);
  },
  MESSAGE_UPDATE: (data) => {
   if (!this.isEnabled()) return;

   messageUpdate.call(this, data);
  },
  MESSAGE_CREATE: (data) => {
   if (!this.isEnabled()) return;

   messageCreate.call(this, data);
  },
  INTERACTION_CREATE: (data) => {
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
  THREAD_UPDATE: (data) => {
   if (!this.isEnabled()) return;

   threadUpdate.call(this, data);
  },
  CHANNEL_DELETE: (data) => {
   if (!this.isEnabled()) return;

   channelDelete.call(this, data);
  },
  THREAD_DELETE: (data) => {
   if (!this.isEnabled()) return;

   threadDelete.call(this, data);
  },
 } as Plugin<Events, APILanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 constructor(client: Client) {
  super(client);

  this.pluginBotKey = 'TICKET_TOKEN';

  this.logger.setLevel(LogLevel.silly);
  assertSchemaValid(this.settingsSchema);

  this.reminders = new TicketReminders(this);
  this.client.cache.on('scheduleExpired', (key: unknown) =>
   this.reminders.onScheduleExpired(String(key)),
  );
  this.reminders.reconcile().catch((e: Error) => this.nonFatalError(e, 'reconcileSchedules'));

  this.satellitesControl = createRedisWrapper({ db: 0 });
  this.satellitesControl.subscribe(SatelliteChannel.Invalid);
  this.satellitesControl.on('message', (...args: unknown[]) => {
   const [channel, message] = args as [string, string];
   if (channel !== SatelliteChannel.Invalid) return;
   try {
    const { cipher } = JSON.parse(message) as { cipher?: string };
    if (cipher) {
     this.invalidateToken(cipher).catch((e: Error) => this.nonFatalError(e, 'satelliteInvalid'));
    }
   } catch (e) {
    this.nonFatalError(e as Error, 'satelliteInvalid');
   }
  });
 }

 reconcileSatellites = () => {
  this.client.cache.cachePub
   .publish(SatelliteChannel.Reconcile, '')
   .catch((e: Error) => this.nonFatalError(e, 'reconcileSatellites'));
 };

 invalidateToken = async (cipher: string): Promise<void> => {
  await this.client.db.client.ticketSetting.updateMany({
   where: { botToken: cipher },
   data: { botToken: null },
  });
 };

 getCustomBotTargets = async (): Promise<Array<{ token: string; guildId: string }>> => {
  const rows = await this.client.db.client.ticketSetting.findMany({
   where: { botToken: { not: null } },
   select: { botToken: true, guild: true },
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

 getEmojiSyncTokens = async (): Promise<string[]> => {
  const rows = await this.client.db.client.ticketSetting.findMany({
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

 onEmojiSyncTokenInvalid = async (token: string): Promise<void> => {
  const rows = await this.client.db.client.ticketSetting.findMany({
   where: { botToken: { not: null } },
   select: { botToken: true },
  });

  const dead = [...new Set(rows.map((row) => row.botToken))].filter(
   (cipher): cipher is string => {
    if (!cipher) return false;
    try {
     return decrypt(cipher) === token;
    } catch {
     return false;
    }
   },
  );

  await Promise.all(dead.map((cipher) => this.invalidateToken(cipher)));
 };

 onGuildRemoved = async (guildId: string) => {
  await this.client.db.client.ticketSetting.updateMany({
   where: { guild: guildId },
   data: { botToken: null },
  });
  this.invalidateGuildAPI(guildId);
  this.reconcileSatellites();
 };

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName(tagCommandName)
    .setDescription('Post a saved snippet into the current ticket, or open the snippet toolkit')
    .addStringOption((option) =>
     option
      .setName('tag')
      .setDescription('The snippet to post')
      .setRequired(false)
      .setAutocomplete(true),
    ),
   new ContextMenuCommandBuilder()
    .setName(forceOpenCommandName)
    .setType(ApplicationCommandType.User),
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
  rowLabel: (t: TicketTranslator, row: TicketSetting) => systemDisplayLabel(t, row),
  overviewDescription: (t: TicketTranslator) => t.settings.overviewDescription(),
  guide: {
   title: (t: TicketTranslator) => t.guide.title(),
   intro: (t: TicketTranslator) => t.guide.intro(),
   advert: {
    text: (t: TicketTranslator) => t.guide.advertText(),
    buttonLabel: (t: TicketTranslator) => t.guide.advertButton(),
    emote: EmoteName.Ticket,
   },
   sections: [
    {
     id: TicketGroups.General,
     label: (t: TicketTranslator) => t.settings.groups.general(),
     description: (t: TicketTranslator) => t.guide.sectionDesc.general(),
     steps: [
      {
       column: 'type',
       label: (t: TicketTranslator) => t.settings.fields.type(),
       required: true,
      },
      {
       column: 'name',
       label: (t: TicketTranslator) => t.base.t.name(),
      },
     ],
    },
    {
     id: TicketGroups.Channels,
     label: (t: TicketTranslator) => t.settings.groups.channels(),
     description: (t: TicketTranslator) => t.guide.sectionDesc.channels(),
     emote: EmoteName.ChannelCategory,
     steps: [
      {
       column: 'category',
       label: (t: TicketTranslator) => t.settings.fields.category(),
       required: true,
       showIf: (row) => ({
        ok: [TicketType.Channel, TicketType.dmToChannel].includes(row.type),
        reason: en.settings.reasons.channelTypeOnly,
       }),
      },
      {
       column: 'channel',
       label: (t: TicketTranslator) => t.settings.fields.channel(),
       required: true,
       showIf: (row) => ({
        ok: [TicketType.Thread, TicketType.dmToThread].includes(row.type),
        reason: en.settings.reasons.threadTypeOnly,
       }),
      },
     ],
    },
    {
     id: TicketGroups.Staff,
     label: (t: TicketTranslator) => t.settings.groups.staff(),
     description: (t: TicketTranslator) => t.guide.sectionDesc.staff(),
     emote: EmoteName.Member,
     steps: [
      {
       column: 'staffRoles',
       label: (t: TicketTranslator) => t.settings.fields.staffRoles(),
       required: (row) => !row.staffUsers.length,
      },
      {
       column: 'staffUsers',
       label: (t: TicketTranslator) => t.settings.fields.staffUsers(),
      },
     ],
    },
    {
     id: TicketGroups.Dm,
     label: (t: TicketTranslator) => t.settings.groups.dm(),
     description: (t: TicketTranslator) => t.guide.sectionDesc.dm(),
     emote: EmoteName.Message,
     showIf: (row) => ({
      ok: [TicketType.dmToThread, TicketType.dmToChannel].includes(row.type),
      reason: en.settings.reasons.dmOnly,
     }),
     steps: [
      {
       column: 'dmEnabled',
       label: (t: TicketTranslator) => t.settings.fields.dmEnabled(),
      },
      {
       column: 'sendMessagePrefixes',
       label: (t: TicketTranslator) => t.settings.fields.sendMessagePrefixes(),
      },
     ],
    },
    {
     id: TicketGroups.Notifications,
     label: (t: TicketTranslator) => t.settings.groups.notifications(),
     description: (t: TicketTranslator) => t.guide.sectionDesc.notifications(),
     emote: EmoteName.Info,
     gate: {
      flag: TicketGuideFlag.WantsNotifications,
      question: (t: TicketTranslator) => t.guide.gates.notifications(),
     },
     steps: [
      {
       column: 'mentionRoles',
       label: (t: TicketTranslator) => t.settings.fields.mentionRoles(),
      },
      {
       column: 'mentionUsers',
       label: (t: TicketTranslator) => t.settings.fields.mentionUsers(),
      },
     ],
    },
    {
     id: TicketGroups.Reminders,
     label: (t: TicketTranslator) => t.settings.groups.reminders(),
     description: (t: TicketTranslator) => t.guide.sectionDesc.reminders(),
     emote: EmoteName.Timer,
     gate: {
      flag: TicketGuideFlag.WantsReminders,
      question: (t: TicketTranslator) => t.guide.gates.reminders(),
     },
     steps: [
      {
       column: 'remindUnclaimedAfter',
       label: (t: TicketTranslator) => t.settings.fields.remindUnclaimedAfter(),
      },
      {
       column: 'remindUnclaimedEvery',
       label: (t: TicketTranslator) => t.settings.fields.remindUnclaimedEvery(),
      },
      {
       column: 'remindStaleAfter',
       label: (t: TicketTranslator) => t.settings.fields.remindStaleAfter(),
      },
      {
       column: 'remindStaleEvery',
       label: (t: TicketTranslator) => t.settings.fields.remindStaleEvery(),
      },
      {
       column: 'remindRoles',
       label: (t: TicketTranslator) => t.settings.fields.remindRoles(),
      },
      {
       column: 'remindUsers',
       label: (t: TicketTranslator) => t.settings.fields.remindUsers(),
      },
     ],
    },
    {
     id: TicketGroups.Inactivity,
     label: (t: TicketTranslator) => t.settings.groups.inactivity(),
     description: (t: TicketTranslator) => t.guide.sectionDesc.inactivity(),
     emote: EmoteName.Warning,
     gate: {
      flag: TicketGuideFlag.WantsAutoClose,
      question: (t: TicketTranslator) => t.guide.gates.autoClose(),
     },
     steps: [
      {
       column: 'inactivityWarnAfter',
       label: (t: TicketTranslator) => t.settings.fields.inactivityWarnAfter(),
      },
      {
       column: 'inactivityCloseAfter',
       label: (t: TicketTranslator) => t.settings.fields.inactivityCloseAfter(),
      },
     ],
    },
    {
     id: TicketGroups.Limits,
     label: (t: TicketTranslator) => t.settings.groups.limits(),
     description: (t: TicketTranslator) => t.guide.sectionDesc.limits(),
     emote: EmoteName.Number,
     gate: {
      flag: TicketGuideFlag.WantsLimits,
      question: (t: TicketTranslator) => t.guide.gates.limits(),
     },
     steps: [
      {
       column: 'ticketLimitTotal',
       label: (t: TicketTranslator) => t.settings.fields.ticketLimitTotal(),
      },
      {
       column: 'ticketLimitKind',
       label: (t: TicketTranslator) => t.settings.fields.ticketLimitKind(),
      },
      {
       column: 'denyRoles',
       label: (t: TicketTranslator) => t.settings.fields.denyRoles(),
      },
      {
       column: 'denyUsers',
       label: (t: TicketTranslator) => t.settings.fields.denyUsers(),
      },
      {
       column: 'allowTakeClaim',
       label: (t: TicketTranslator) => t.settings.fields.allowTakeClaim(),
      },
      {
       column: 'staffTierRoles',
       label: (t: TicketTranslator) => t.settings.fields.staffTierRoles(),
       showIf: (row) => ({
        ok: Boolean(row.allowTakeClaim),
        reason: en.settings.reasons.takeClaimOff,
       }),
      },
     ],
    },
    {
     id: TicketGroups.BotIdentity,
     label: (t: TicketTranslator) => t.settings.groups.botIdentity(),
     description: (t: TicketTranslator) => t.guide.sectionDesc.botIdentity(),
     emote: EmoteName.Lock,
     gate: {
      flag: TicketGuideFlag.WantsCustomBot,
      question: (t: TicketTranslator) => t.guide.gates.customBot(),
     },
     steps: [
      {
       column: 'botToken',
       label: (t: TicketTranslator) => t.settings.fields.botToken(),
      },
      {
       column: 'presenceType',
       label: (t: TicketTranslator) => t.settings.fields.presenceType(),
       showIf: (row) => ({
        ok: Boolean(row.botToken),
        reason: en.settings.reasons.customBotOnly,
       }),
      },
      {
       column: 'presenceText',
       label: (t: TicketTranslator) => t.settings.fields.presenceText(),
       showIf: (row) => ({
        ok: Boolean(row.botToken) && Boolean(row.presenceType),
        reason: row.botToken
         ? en.settings.reasons.presenceTypeUnset
         : en.settings.reasons.customBotOnly,
       }),
      },
     ],
    },
    {
     id: TicketGuideSection.GoLive,
     label: (t: TicketTranslator) => t.guide.goLive.label(),
     description: (t: TicketTranslator) => t.guide.sectionDesc.goLive(),
     emote: EmoteName.Send,
     steps: [
      {
       column: 'active',
       label: (t: TicketTranslator) => t.guide.goLive.enable(),
       description: (t: TicketTranslator) => t.guide.goLive.enableDesc(),
       required: true,
      },
      {
       action: {
        customId: TicketRoute.Panel,
        doneIf: async (row, ctx) => {
         const panels = await ctx.client.db.client.ticketPanel.findMany({
          where: { guild: row.guild },
         });
         return panels.some(
          (panel) =>
           Boolean(panel.message) && panel.kinds.some((kind) => String(kind) === String(row.id)),
         );
        },
       },
       label: (t: TicketTranslator) => t.guide.goLive.panel(),
       description: (t: TicketTranslator) => t.guide.goLive.panelDesc(),
       required: (row) =>
        !(
         [TicketType.dmToChannel, TicketType.dmToThread].includes(row.type) && row.dmEnabled
        ),
      },
     ],
    },
   ],
  },
  rowSummary: (t: TicketTranslator, row: TicketSetting) => {
   const typeLabels: Record<TicketType, string> = {
    [TicketType.Channel]: t.base.t.Channel(),
    [TicketType.Thread]: t.base.t.Thread(),
    [TicketType.dmToChannel]: t.settings.options.dmToChannel(),
    [TicketType.dmToThread]: t.settings.options.dmToThread(),
   };
   const status = row.active ? t.base.t.Active() : t.base.t.Disabled();
   const dm = row.dmEnabled ? t.settings.dmOn() : t.settings.dmOff();
   return t.settings.systemSummary({ type: typeLabels[row.type], status, dm });
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

   const max = 20;
   const shown = open.slice(0, max).map((ticket) => `- <#${ticket.channel}>`);
   const overflow = open.length - shown.length;
   const list = overflow
    ? `${shown.join('\n')}\n${t.settings.deleteBlockedMore({ count: String(overflow) })}`
    : shown.join('\n');

   return {
    ok: false,
    reason: t.settings.deleteBlocked({ count: String(open.length), list }),
   };
  },
  groups: [
   {
    id: TicketGroups.General,
    label: (t: TicketTranslator) => t.settings.groups.general(),
    description: (t: TicketTranslator) => t.settings.groupDescriptions.general(),
    fields: [
     {
      column: 'active',
      editor: EditorType.Boolean,
      label: (t: TicketTranslator) => t.base.t.Active(),
      headerToggle: true,
     },
     {
      column: 'name',
      editor: EditorType.String,
      label: (t: TicketTranslator) => t.base.t.name(),
      description: (t: TicketTranslator) => t.settings.descriptions.name(),
      arity: FieldArity.Single,
     },
     {
      column: 'type',
      editor: EditorType.TicketType,
      label: (t: TicketTranslator) => t.settings.fields.type(),
      description: (t: TicketTranslator) => t.settings.descriptions.type(),
      arity: FieldArity.Single,
      required: true,
      options: [
       {
        value: TicketType.Channel,
        label: (t: TicketTranslator) => t.base.t.Channel(),
        description: (t: TicketTranslator) => t.settings.optionDescriptions.channel(),
       },
       {
        value: TicketType.Thread,
        label: (t: TicketTranslator) => t.base.t.Thread(),
        description: (t: TicketTranslator) => t.settings.optionDescriptions.thread(),
       },
       {
        value: TicketType.dmToChannel,
        label: (t: TicketTranslator) => t.settings.options.dmToChannel(),
        description: (t: TicketTranslator) => t.settings.optionDescriptions.dmToChannel(),
       },
       {
        value: TicketType.dmToThread,
        label: (t: TicketTranslator) => t.settings.options.dmToThread(),
        description: (t: TicketTranslator) => t.settings.optionDescriptions.dmToThread(),
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
      column: 'transcriptChannels',
      editor: EditorType.Channels,
      label: (t: TicketTranslator) => t.settings.fields.transcriptChannels(),
      description: (t: TicketTranslator) => t.settings.descriptions.transcriptChannels(),
      channelTypes: [ChannelType.GuildText],
      arity: FieldArity.Multi,
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
    description: (t: TicketTranslator) => t.settings.groupDescriptions.channels(),
    emote: EmoteName.ChannelText,
    fields: [
     {
      column: 'category',
      editor: EditorType.Category,
      label: (t: TicketTranslator) => t.settings.fields.category(),
      description: (t: TicketTranslator) => t.settings.descriptions.category(),
      required: true,
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
      channelTypes: [ChannelType.GuildText],
      required: true,
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
      editor: EditorType.ThreadAutoArchiveDuration,
      label: (t: TicketTranslator) => t.settings.fields.archiveDuration(),
      description: (t: TicketTranslator) => t.settings.descriptions.archiveDuration(),
      arity: FieldArity.Single,
      showIf: (row) => ({
       ok: [TicketType.Thread, TicketType.dmToThread].includes(row.type),
       reason: en.settings.reasons.threadTypeOnly,
      }),
      options: [
       {
        value: ThreadArchiveDuration.OneHour,
        label: (t: TicketTranslator) => t.settings.durations['1h'](),
       },
       {
        value: ThreadArchiveDuration.OneDay,
        label: (t: TicketTranslator) => t.settings.durations['24h'](),
       },
       {
        value: ThreadArchiveDuration.ThreeDays,
        label: (t: TicketTranslator) => t.settings.durations['3d'](),
       },
       {
        value: ThreadArchiveDuration.OneWeek,
        label: (t: TicketTranslator) => t.settings.durations['1w'](),
       },
      ],
     },
     {
      column: 'logChannels',
      editor: EditorType.Channels,
      label: (t: TicketTranslator) => t.settings.fields.logChannels(),
      description: (t: TicketTranslator) => t.settings.descriptions.logChannels(),
      channelTypes: [ChannelType.GuildText],
      arity: FieldArity.Multi,
     },
    ],
   },
   {
    id: TicketGroups.Staff,
    label: (t: TicketTranslator) => t.settings.groups.staff(),
    description: (t: TicketTranslator) => t.settings.groupDescriptions.staff(),
    emote: EmoteName.Member,
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
      channelTypes: [ChannelType.GuildText],
      showIf: (row) => {
       const threadType = [TicketType.Thread, TicketType.dmToThread].includes(row.type);

       return {
        ok: threadType && Boolean(row.staffThreads),
        reason: threadType
         ? en.settings.reasons.staffThreadsOff
         : en.settings.reasons.threadTypeOnly,
       };
      },
     },
    ],
   },
   {
    id: TicketGroups.Notifications,
    label: (t: TicketTranslator) => t.settings.groups.notifications(),
    description: (t: TicketTranslator) => t.settings.groupDescriptions.notifications(),
    emote: EmoteName.Info,
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
    ],
   },
   {
    id: TicketGroups.Dm,
    label: (t: TicketTranslator) => t.settings.groups.dm(),
    description: (t: TicketTranslator) => t.settings.groupDescriptions.dm(),
    emote: EmoteName.Message,
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
    description: (t: TicketTranslator) => t.settings.groupDescriptions.panel(),
    emote: EmoteName.Message,
    fields: [
     {
      column: 'dmEnabled',
      editor: EditorType.Boolean,
      label: (t: TicketTranslator) => t.settings.fields.dmEnabled(),
      description: (t: TicketTranslator) => t.settings.descriptions.dmEnabled(),
      showIf: (row) => ({
       ok: [TicketType.dmToThread, TicketType.dmToChannel].includes(row.type),
       reason: en.settings.reasons.dmOnly,
      }),
     },
     {
      column: 'dmInstantOpen',
      editor: EditorType.Boolean,
      label: (t: TicketTranslator) => t.settings.fields.dmInstantOpen(),
      description: (t: TicketTranslator) => t.settings.descriptions.dmInstantOpen(),
      showIf: (row) => {
       const dmType = [TicketType.dmToThread, TicketType.dmToChannel].includes(row.type);

       if (!dmType) return { ok: false, reason: en.settings.reasons.dmOnly };
       if (!row.dmEnabled) return { ok: false, reason: en.settings.reasons.dmIntakeOff };

       return { ok: Boolean(row.botToken), reason: en.settings.reasons.customBotOnly };
      },
     },
    ],
    actions: [
     {
      customId: TicketRoute.Panel,
      label: (t: TicketTranslator) => t.panel.editorTitle(),
      description: (t: TicketTranslator) => t.settings.descriptions.panelEditor(),
      emote: EmoteName.Message,
     },
    ],
   },
   {
    id: TicketGroups.Forum,
    label: (t: TicketTranslator) => t.settings.groups.forum(),
    description: (t: TicketTranslator) => t.settings.groupDescriptions.forum(),
    emote: EmoteName.ChannelForum,
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
    ],
   },
   {
    id: TicketGroups.Reminders,
    label: (t: TicketTranslator) => t.settings.groups.reminders(),
    description: (t: TicketTranslator) => t.settings.groupDescriptions.reminders(),
    emote: EmoteName.Timer,
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
    description: (t: TicketTranslator) => t.settings.groupDescriptions.inactivity(),
    emote: EmoteName.Timer,
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
    description: (t: TicketTranslator) => t.settings.groupDescriptions.remindTargets(),
    emote: EmoteName.Member,
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
    description: (t: TicketTranslator) => t.settings.groupDescriptions.botIdentity(),
    emote: EmoteName.Lock,
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
    actions: [
     {
      customId: TicketRoute.InviteBot,
      label: (t: TicketTranslator) => t.settings.inviteBotLabel(),
      description: (t: TicketTranslator) => t.settings.descriptions.inviteBot(),
      buttonLabel: (t: TicketTranslator) => t.base.t.Invite(),
      emote: EmoteName.Bot,
     },
     {
      customId: TicketRoute.ClearBotToken,
      label: (t: TicketTranslator) => t.settings.clearTokenLabel(),
      description: (t: TicketTranslator) => t.settings.descriptions.clearToken(),
      buttonLabel: (t: TicketTranslator) => t.base.t.Clear(),
      emote: EmoteName.Trash,
     },
    ],
   },
   {
    id: TicketGroups.Presence,
    label: (t: TicketTranslator) => t.settings.groups.presence(),
    description: (t: TicketTranslator) => t.settings.groupDescriptions.presence(),
    emote: EmoteName.Bot,
    fields: [
     {
      column: 'presenceType',
      editor: EditorType.PresenceActivityType,
      label: (t: TicketTranslator) => t.settings.fields.presenceType(),
      description: (t: TicketTranslator) => t.settings.descriptions.presenceType(),
      arity: FieldArity.Single,
      showIf: (row) => ({ ok: Boolean(row.botToken), reason: en.settings.reasons.customBotOnly }),
      options: [
       {
        value: PresenceActivityType.Playing,
        label: (t: TicketTranslator) => t.settings.options.playing(),
       },
       {
        value: PresenceActivityType.Listening,
        label: (t: TicketTranslator) => t.settings.options.listening(),
       },
       {
        value: PresenceActivityType.Watching,
        label: (t: TicketTranslator) => t.settings.options.watching(),
       },
       {
        value: PresenceActivityType.Competing,
        label: (t: TicketTranslator) => t.settings.options.competing(),
       },
       {
        value: PresenceActivityType.Custom,
        label: (t: TicketTranslator) => t.settings.options.custom(),
       },
      ],
     },
     {
      column: 'presenceText',
      editor: EditorType.String,
      label: (t: TicketTranslator) => t.settings.fields.presenceText(),
      description: (t: TicketTranslator) => t.settings.descriptions.presenceText(),
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
      transform: presenceEmojiTransform,
      label: (t: TicketTranslator) => t.settings.fields.presenceEmoji(),
      description: (t: TicketTranslator) => t.settings.descriptions.presenceEmoji(),
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
    id: TicketGroups.Profile,
    label: (t: TicketTranslator) => t.settings.groups.profile(),
    description: (t: TicketTranslator) => t.settings.groupDescriptions.profile(),
    emote: EmoteName.Image,
    fields: [
     {
      column: 'profileNick',
      editor: EditorType.String,
      label: (t: TicketTranslator) => t.settings.fields.profileNick(),
      description: (t: TicketTranslator) => t.settings.descriptions.profileNick(),
      arity: FieldArity.Single,
      virtual: botProfileVirtual(BotProfilePart.Nick),
     },
     {
      column: 'profileAvatar',
      editor: EditorType.String,
      label: (t: TicketTranslator) => t.settings.fields.profileAvatar(),
      description: (t: TicketTranslator) => t.settings.descriptions.profileAvatar(),
      arity: FieldArity.Single,
      transform: botProfileImageTransform,
      virtual: botProfileVirtual(BotProfilePart.Avatar),
      showIf: (row) => ({
       ok: Boolean(row.botToken),
       reason: en.settings.reasons.customBotOnly,
      }),
     },
     {
      column: 'profileBanner',
      editor: EditorType.String,
      label: (t: TicketTranslator) => t.settings.fields.profileBanner(),
      description: (t: TicketTranslator) => t.settings.descriptions.profileBanner(),
      arity: FieldArity.Single,
      transform: botProfileImageTransform,
      virtual: botProfileVirtual(BotProfilePart.Banner),
      showIf: (row) => ({
       ok: Boolean(row.botToken),
       reason: en.settings.reasons.customBotOnly,
      }),
     },
    ],
   },
   {
    id: TicketGroups.Escalation,
    label: (t: TicketTranslator) => t.settings.groups.escalation(),
    description: (t: TicketTranslator) => t.settings.groupDescriptions.escalation(),
    emote: EmoteName.Tools,
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
      channelTypes: [ChannelType.GuildForum],
      showIf: (row) => ({
       ok: row.placementMode === TicketPlacementMode.UnifiedForum,
       reason: en.settings.reasons.forumModeOnly,
      }),
     },
    ],
    actions: [
     {
      customId: TicketRoute.TierManage,
      label: (t: TicketTranslator) => t.tierEditor.title(),
      description: (t: TicketTranslator) => t.settings.descriptions.tierEditor(),
      emote: EmoteName.Tools,
     },
    ],
   },
   {
    id: TicketGroups.Limits,
    label: (t: TicketTranslator) => t.settings.groups.limits(),
    description: (t: TicketTranslator) => t.settings.groupDescriptions.limits(),
    emote: EmoteName.Member,
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
  ],
 } satisfies SettingsSchemaDef<
  TicketSetting & TicketVirtualColumns,
  TicketTranslator
 > as unknown as SettingsSchemaDef;

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
