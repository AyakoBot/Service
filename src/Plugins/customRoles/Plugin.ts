import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits, type GatewayDispatchEvents } from '@discordjs/core';

import Plugin, {
 idSelector,
 PluginName,
 SettingsCategory,
 type BaseLang,
} from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import type { TranslatorType } from '../../Util/translator.js';
import { assertSchemaValid } from '../settings/SettingsSchema.js';

import { customRoleCommand } from './Classes/Commands.js';
import ActivityTracker from './Classes/ActivityTracker.js';
import CustomRoleService from './Classes/CustomRoleService.js';
import InactivitySweep from './Classes/InactivitySweep.js';
import RolePerks from './Classes/RolePerks.js';
import settingsSchema from './Classes/settingsSchema.js';
import guildMemberRemove from './Events/GuildMemberRemove/index.js';
import guildMemberUpdate from './Events/GuildMemberUpdate/index.js';
import guildRoleDelete from './Events/GuildRoleDelete/index.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';
import messageReactionAdd from './Events/MessageReactionAdd/index.js';
// TODO: request presence intent for this
// import presenceUpdate from './Events/PresenceUpdate/index.js';
import voiceStateUpdate from './Events/VoiceStateUpdate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events =
 | GatewayDispatchEvents.InteractionCreate
 | GatewayDispatchEvents.GuildMemberUpdate
 | GatewayDispatchEvents.GuildMemberRemove
 | GatewayDispatchEvents.GuildRoleDelete
 | GatewayDispatchEvents.MessageCreate
 | GatewayDispatchEvents.MessageReactionAdd
 | GatewayDispatchEvents.VoiceStateUpdate;
 // TODO: request presence intent for this
 // | GatewayDispatchEvents.PresenceUpdate;

type CustomRolesLanguage = typeof en;
export type CustomRolesTranslator = TranslatorType<CustomRolesLanguage> & { base: BaseLang };

export default class CustomRolesPlugin extends Plugin<Events, CustomRolesLanguage> {
 name = 'Custom Roles';
 settingName = PluginName.CustomRoles;

 tableName = 'roleReward';

 dependencies = [PluginName.Settings];

 customBotPerms =
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks;

 rewards: RolePerks;
 roles: CustomRoleService;
 activity: ActivityTracker;
 inactivity: InactivitySweep;

 settingsSchema = settingsSchema;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };

 eventHandlers = {
  INTERACTION_CREATE: (data) => {
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
  GUILD_MEMBER_UPDATE: (data) => {
   if (!this.isEnabled()) return;

   guildMemberUpdate.call(this, data);
  },
  GUILD_MEMBER_REMOVE: (data) => {
   if (!this.isEnabled()) return;

   guildMemberRemove.call(this, data);
  },
  GUILD_ROLE_DELETE: (data) => {
   if (!this.isEnabled()) return;

   guildRoleDelete.call(this, data);
  },
  MESSAGE_CREATE: (data) => {
   if (!this.isEnabled()) return;

   messageCreate
    .call(this, data)
    .catch((error: Error) => this.nonFatalError(error, 'customRoles.activity'));
  },
  MESSAGE_REACTION_ADD: (data) => {
   if (!this.isEnabled()) return;

   messageReactionAdd
    .call(this, data)
    .catch((error: Error) => this.nonFatalError(error, 'customRoles.activity'));
  },
  VOICE_STATE_UPDATE: (data) => {
   if (!this.isEnabled()) return;

   voiceStateUpdate
    .call(this, data)
    .catch((error: Error) => this.nonFatalError(error, 'customRoles.activity'));
  },
  // TODO: request presence intent for this
  // PRESENCE_UPDATE: (data) => {
   // if (!this.isEnabled()) return;
  //
   // presenceUpdate
    // .call(this, data)
    // .catch((error: Error) => this.nonFatalError(error, 'customRoles.activity'));
  // },
 } as Plugin<Events, CustomRolesLanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 constructor(client: Client) {
  super(client);
  assertSchemaValid(this.settingsSchema);

  this.rewards = new RolePerks(this);
  this.roles = new CustomRoleService(this);
  this.activity = new ActivityTracker(this);
  this.inactivity = new InactivitySweep(this);

  this.pluginBotKey = 'CUSTOM_ROLES_TOKEN';

  this.client.cache.on('scheduleExpired', (key: unknown) =>
   this.rewards.onScheduleExpired(String(key)),
  );
  this.client.cache.on('scheduleExpired', (key: unknown) =>
   this.inactivity
    .onScheduleExpired(String(key))
    .catch((error: Error) => this.nonFatalError(error, 'customRoles.inactivitySweep')),
  );
  this.inactivity
   .arm()
   .catch((error: Error) => this.nonFatalError(error, 'customRoles.armInactivity'));

  this.rewards
   .reconcileEligibility()
   .catch((error: Error) => this.nonFatalError(error, 'customRoles.reconcileEligibility'));
 }

 onGuildRemoved = async (guildId: string) => {
  await Promise.all([
   this.client.db.client.customRole.deleteMany({ where: { guild: guildId } }),
   this.client.db.client.roleRewardEligibility.deleteMany({ where: { guild: guildId } }),
   this.client.db.client.lastActive.deleteMany({ where: { guild: guildId } }),
  ]);

  await this.client.db.client.roleReward.deleteMany({ where: { guild: guildId } });
 };

 getCommands = () => ({
  commands: [customRoleCommand()],
  settings: [
   {
    category: SettingsCategory.Roles,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName(PluginName.CustomRoles)
      .setDescription('Configure role rewards and member Custom-Roles')
      .addStringOption(idSelector),
    ],
   },
  ],
 });
}
