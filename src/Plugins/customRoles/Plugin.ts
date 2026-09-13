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
import CustomRoleService from './Classes/CustomRoleService.js';
import RolePerks from './Classes/RolePerks.js';
import settingsSchema from './Classes/settingsSchema.js';
import guildMemberRemove from './Events/GuildMemberRemove/index.js';
import guildMemberUpdate from './Events/GuildMemberUpdate/index.js';
import guildRoleDelete from './Events/GuildRoleDelete/index.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events =
 | GatewayDispatchEvents.InteractionCreate
 | GatewayDispatchEvents.GuildMemberUpdate
 | GatewayDispatchEvents.GuildMemberRemove
 | GatewayDispatchEvents.GuildRoleDelete;

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

 settingsSchema = settingsSchema;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };

 eventHandlers = {
  INTERACTION_CREATE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
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
  GUILD_ROLE_DELETE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove
   if (!this.isEnabled()) return;

   guildRoleDelete.call(this, data);
  },
 } as Plugin<Events, CustomRolesLanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 constructor(client: Client) {
  super(client);
  assertSchemaValid(this.settingsSchema);

  this.rewards = new RolePerks(this);
  this.roles = new CustomRoleService(this);

  this.pluginBotKey = 'CUSTOM_ROLES_TOKEN';

  this.client.cache.on('scheduleExpired', (key: unknown) =>
   this.rewards.onScheduleExpired(String(key)),
  );

  this.rewards
   .reconcileEligibility()
   .catch((error: Error) => this.nonFatalError(error, 'customRoles.reconcileEligibility'));
 }

 onGuildRemoved = async (guildId: string) => {
  await Promise.all([
   this.client.db.client.customRole.deleteMany({ where: { guild: guildId } }),
   this.client.db.client.roleRewardEligibility.deleteMany({ where: { guild: guildId } }),
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
