import type { VerificationSetting } from '@ayako/database';
import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { ChannelType, PermissionFlagsBits, type GatewayDispatchEvents } from '@discordjs/core';

import Plugin, {
 PluginName,
 SettingsCategory,
 type BaseLang,
} from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import { EmoteName } from '../../Classes/EmoteName.js';
import type { ButtonAction } from '../../Util/buttonActions.js';
import {
 countPlaceholders,
 renderPlaceholderList,
 withServerPlaceholders,
} from '../../Util/messagePlaceholders.js';
import { PluginBotKey } from '../../Util/pluginBotKey.js';
import { savedDesignField } from '../../Util/savedRef.js';
import type { TranslatorType } from '../../Util/translator.js';
import { EditorType } from '../settings/Plugin.js';
import {
 assertSchemaValid,
 FieldArity,
 type SettingsSchemaDef,
} from '../settings/SettingsSchema.js';

import { VerificationRoute } from './Classes/Routes.js';
import VerificationKicks from './Classes/VerificationKicks.js';
import guildMemberAdd from './Events/GuildMemberAdd/index.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.GuildMemberAdd | GatewayDispatchEvents.InteractionCreate;

type VerificationLanguage = typeof en;
type VerificationTranslator = TranslatorType<VerificationLanguage> & { base: BaseLang };

type VerificationVirtualColumns = {
 panelDesign: string | null;
};

export enum VerificationGroups {
 General = 'general',
 Roles = 'roles',
 Kick = 'kick',
}

const verificationPlaceholders = withServerPlaceholders(...countPlaceholders);

export default class VerificationPlugin extends Plugin<Events, VerificationLanguage> {
 name = 'Verification';
 settingName = PluginName.Verification;
 dependencies = [PluginName.Settings];
 tableName = 'VerificationSetting';
 pilotGuilds = ['1518697272525979648'];
 placeholders = verificationPlaceholders;

 buttonActions: ButtonAction[] = [
  {
   route: VerificationRoute.Verify,
   label: async (guildId: string) => (await this.t(guildId)).verify(),
  },
 ];

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.KickMembers;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };

 eventHandlers = {
  GUILD_MEMBER_ADD: (data) => {
   if (!this.isLiveFor(data.guild_id ?? '')) return;
   if (!this.isEnabled()) return;

   guildMemberAdd.call(this, data);
  },
  INTERACTION_CREATE: (data) => {
   if (!this.isLiveFor(data.guild_id ?? '')) return;
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
 } as Plugin<Events, VerificationLanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 kicks = new VerificationKicks(this);

 constructor(client: Client) {
  super(client);

  this.pluginBotKey = PluginBotKey.Verification;
  assertSchemaValid(this.settingsSchema);

  this.client.cache.on('scheduleExpired', (key: unknown) =>
   this.kicks.onScheduleExpired(String(key)),
  );
  this.kicks.reconcile().catch((e: Error) => this.nonFatalError(e, 'reconcileSchedules'));
 }

 onGuildRemoved = async (guildId: string) => {
  await this.client.db.client.verificationSetting.deleteMany({ where: { guild: guildId } });
 };

 getCommands = () => ({
  commands: [],
  settings: [
   {
    category: SettingsCategory.Automation,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName(PluginName.Verification)
      .setDescription('Configure verification'),
    ],
   },
  ],
 });

 settingsSchema: SettingsSchemaDef = {
  table: 'verificationSetting',
  rowKey: 'id',
  multiRow: false,
  title: (t: VerificationTranslator) => t.settings.configTitle(),
  overviewDescription: (t: VerificationTranslator) => t.settings.overviewDescription(),
  rowLabel: (t: VerificationTranslator) => t.settings.configTitle(),
  groups: [
   {
    id: VerificationGroups.General,
    label: (t: VerificationTranslator) => t.settings.groups.general(),
    emote: EmoteName.Shield,
    fields: [
     {
      column: 'active',
      editor: EditorType.Boolean,
      headerToggle: true,
      label: (t: VerificationTranslator) => t.settings.fields.active(),
      description: (t: VerificationTranslator) => t.settings.descriptions.active(),
     },
     {
      column: 'channel',
      editor: EditorType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      required: true,
      label: (t: VerificationTranslator) => t.settings.fields.channel(),
      description: (t: VerificationTranslator) => t.settings.descriptions.channel(),
     },
     {
      column: 'logChannel',
      editor: EditorType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      label: (t: VerificationTranslator) => t.settings.fields.logChannel(),
      description: (t: VerificationTranslator) => t.settings.descriptions.logChannel(),
     },
     {
      column: 'panelDesign',
      editor: EditorType.SavedDesign,
      emote: EmoteName.Message,
      label: (t: VerificationTranslator) => t.settings.fields.panelDesign(),
      description: (t: VerificationTranslator) =>
       t.settings.descriptions.panelDesign({
        list: renderPlaceholderList(verificationPlaceholders),
       }),
      arity: FieldArity.Single,
      ...savedDesignField(
       'verificationSetting',
       { embed: 'panelEmbed', components: 'panelComponents' },
       2,
      ),
     },
    ],
    actions: [
     {
      customId: VerificationRoute.PostPanel,
      label: (t: VerificationTranslator) => t.settings.postPanel(),
      description: (t: VerificationTranslator) => t.settings.postPanelDescription(),
      buttonLabel: (t: VerificationTranslator) => t.base.t.Post(),
      emote: EmoteName.Message,
     },
    ],
   },
   {
    id: VerificationGroups.Roles,
    label: (t: VerificationTranslator) => t.settings.groups.roles(),
    emote: EmoteName.Role,
    fields: [
     {
      column: 'verifiedRole',
      editor: EditorType.Role,
      required: true,
      label: (t: VerificationTranslator) => t.settings.fields.verifiedRole(),
      description: (t: VerificationTranslator) => t.settings.descriptions.verifiedRole(),
     },
     {
      column: 'pendingRole',
      editor: EditorType.Role,
      label: (t: VerificationTranslator) => t.settings.fields.pendingRole(),
      description: (t: VerificationTranslator) => t.settings.descriptions.pendingRole(),
     },
    ],
   },
   {
    id: VerificationGroups.Kick,
    label: (t: VerificationTranslator) => t.settings.groups.kick(),
    emote: EmoteName.Kick,
    fields: [
     {
      column: 'kick',
      editor: EditorType.Boolean,
      label: (t: VerificationTranslator) => t.settings.fields.kick(),
      description: (t: VerificationTranslator) => t.settings.descriptions.kick(),
     },
     {
      column: 'kickAfter',
      editor: EditorType.Duration,
      label: (t: VerificationTranslator) => t.settings.fields.kickAfter(),
      description: (t: VerificationTranslator) => t.settings.descriptions.kickAfter(),
      showIf: (row) => ({ ok: row.kick, reason: en.settings.reasons.kickOnly }),
     },
    ],
   },
  ],
  guide: {
   title: (t: VerificationTranslator) => t.guide.title(),
   intro: (t: VerificationTranslator) => t.guide.intro(),
   advert: {
    text: (t: VerificationTranslator) => t.guide.advertText(),
    buttonLabel: (t: VerificationTranslator) => t.guide.advertButton(),
    emote: EmoteName.Shield,
   },
   sections: [
    {
     id: VerificationGroups.General,
     label: (t: VerificationTranslator) => t.settings.groups.general(),
     emote: EmoteName.Shield,
     steps: [
      {
       column: 'channel',
       label: (t: VerificationTranslator) => t.settings.fields.channel(),
       required: true,
      },
      {
       column: 'verifiedRole',
       label: (t: VerificationTranslator) => t.settings.fields.verifiedRole(),
       required: true,
      },
      {
       action: {
        customId: VerificationRoute.PostPanel,
        doneIf: (row) => Boolean(row.panelMessage),
       },
       label: (t: VerificationTranslator) => t.settings.postPanel(),
       description: (t: VerificationTranslator) => t.settings.postPanelDescription(),
      },
      {
       column: 'active',
       label: (t: VerificationTranslator) => t.guide.enable(),
       required: true,
      },
      {
       column: 'pendingRole',
       label: (t: VerificationTranslator) => t.settings.fields.pendingRole(),
      },
     ],
    },
   ],
  },
 } satisfies SettingsSchemaDef<
  VerificationSetting & VerificationVirtualColumns,
  VerificationTranslator
 >;
}
