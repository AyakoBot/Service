import type { EconomySetting } from '@ayako/database';
import { decrypt, LogLevel } from '@ayako/utility';
import {
 SlashCommandBuilder,
 SlashCommandIntegerOption,
 SlashCommandStringOption,
 SlashCommandSubcommandBuilder,
 SlashCommandUserOption,
} from '@discordjs/builders';
import { GatewayDispatchEvents, PermissionFlagsBits } from '@discordjs/core';
import { ChannelType } from 'discord-api-types/v10';

import Plugin, {
 PluginName,
 SettingsCategory,
 type BaseLang,
} from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import type { ExtractPayload } from '../../Types/gateway.js';
import type { TranslatorType } from '../../Util/translator.js';
import { EditorType } from '../settings/Plugin.js';
import {
 assertSchemaValid,
 FieldArity,
 type SettingsSchemaDef,
} from '../settings/SettingsSchema.js';

import { EconomyCommand, EconomyOption, EconomySubcommand } from './Classes/Commands.js';
import EconomyBank from './Classes/EconomyBank.js';
import EconomyLogger from './Classes/EconomyLogger.js';
import EconomyRewards from './Classes/EconomyRewards.js';
import { EconomyGroups } from './Classes/Enums.js';
import rewardsSchema from './Classes/rewardsSchema.js';
import channelDelete from './Events/ChannelDelete/index.js';
import guildMemberUpdate from './Events/GuildMemberUpdate/index.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';
import messageDelete from './Events/MessageDelete/index.js';
import en from './Language/en-GB.json' with { type: 'json' };
import { BotProfilePart, botProfileImageTransform, botProfileVirtual } from './Util/botProfile.js';
import { economyBotTokenTransform } from './Util/botToken.js';

type EconomyVirtualColumns = {
 profileNick: string | null;
 profileAvatar: string | null;
 profileBanner: string | null;
 profileBio: string | null;
};

type Events =
 | GatewayDispatchEvents.MessageCreate
 | GatewayDispatchEvents.MessageDelete
 | GatewayDispatchEvents.ChannelDelete
 | GatewayDispatchEvents.GuildMemberUpdate
 | GatewayDispatchEvents.InteractionCreate;

type EconomyLanguage = typeof en;
export type EconomyTranslator = TranslatorType<EconomyLanguage> & { base: BaseLang };

const amountOption = (required: boolean, min: number = 1) =>
 new SlashCommandIntegerOption()
  .setName(EconomyOption.Amount)
  .setDescription('The amount of currency')
  .setMinValue(min)
  .setRequired(required);

const userOption = (required: boolean) =>
 new SlashCommandUserOption()
  .setName(EconomyOption.User)
  .setDescription('The member to target')
  .setRequired(required);

const reasonOption = () =>
 new SlashCommandStringOption()
  .setName(EconomyOption.Reason)
  .setDescription('Why this change is being made')
  .setMaxLength(200);

export default class EconomyPlugin extends Plugin<Events, EconomyLanguage> {
 name = 'Economy';
 settingName = PluginName.Economy;
 dependencies = [PluginName.Settings];
 tableName = 'EconomySetting';

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.ManageRoles;

 bank: EconomyBank;
 economyLog: EconomyLogger;
 rewards: EconomyRewards;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {
  [GatewayDispatchEvents.MessageCreate]: (
   data: ExtractPayload<GatewayDispatchEvents.MessageCreate>,
  ) => {
   if (!this.isEnabled()) return;

   messageCreate.call(this, data);
  },
  [GatewayDispatchEvents.MessageDelete]: (
   data: ExtractPayload<GatewayDispatchEvents.MessageDelete>,
  ) => {
   if (!this.isEnabled()) return;

   messageDelete.call(this, data);
  },
  [GatewayDispatchEvents.ChannelDelete]: (
   data: ExtractPayload<GatewayDispatchEvents.ChannelDelete>,
  ) => {
   if (!this.isEnabled()) return;

   channelDelete.call(this, data);
  },
  [GatewayDispatchEvents.GuildMemberUpdate]: (
   data: ExtractPayload<GatewayDispatchEvents.GuildMemberUpdate>,
  ) => {
   if (!this.isEnabled()) return;

   guildMemberUpdate.call(this, data);
  },
  [GatewayDispatchEvents.InteractionCreate]: (
   data: ExtractPayload<GatewayDispatchEvents.InteractionCreate>,
  ) => {
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
 } as Plugin<Events, EconomyLanguage>['eventHandlers'];

 constructor(client: Client) {
  super(client);

  this.bank = new EconomyBank(this);
  this.economyLog = new EconomyLogger(this);
  this.rewards = new EconomyRewards(this);

  this.pluginBotKey = 'ECONOMY_TOKEN';
  this.logger.setLevel(LogLevel.silly);

  assertSchemaValid(this.settingsSchema);
  assertSchemaValid(this.rewardsSchema);
 }

 symbolOf = (settings: EconomySetting): string =>
  settings.currencyEmote || settings.currencyName || '';

 getEmojiSyncTokens = async (): Promise<string[]> => {
  const rows = await this.client.db.client.economySetting.findMany({
   where: { botToken: { not: null } },
   select: { botToken: true },
  });

  return rows.flatMap((row) => {
   if (!row.botToken) return [];

   try {
    return [decrypt(row.botToken)];
   } catch {
    return [];
   }
  });
 };

 getCustomBotTargets = async (): Promise<Array<{ token: string; guildId: string }>> => {
  const rows = await this.client.db.client.economySetting.findMany({
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

 invalidateToken = async (cipher: string): Promise<void> => {
  await this.client.db.client.economySetting.updateMany({
   where: { botToken: cipher },
   data: { botToken: null },
  });
 };

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName(EconomyCommand.Balance)
    .setDescription('Show how much currency you or another member has')
    .addUserOption(userOption(false)),
   new SlashCommandBuilder()
    .setName(EconomyCommand.Baltop)
    .setDescription('Show the richest members of this server'),
   new SlashCommandBuilder()
    .setName(EconomyCommand.Pay)
    .setDescription('Send currency to another member')
    .addUserOption(userOption(true))
    .addIntegerOption(amountOption(true)),
   new SlashCommandBuilder()
    .setName(EconomyCommand.Economy)
    .setDescription('Manage this server currency')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(EconomySubcommand.Leaderboard)
      .setDescription('Show the richest members'),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(EconomySubcommand.Give)
      .setDescription('Give currency to a member')
      .addUserOption(userOption(true))
      .addIntegerOption(amountOption(true))
      .addStringOption(reasonOption()),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(EconomySubcommand.Take)
      .setDescription('Take currency from a member')
      .addUserOption(userOption(true))
      .addIntegerOption(amountOption(true))
      .addStringOption(reasonOption()),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(EconomySubcommand.Set)
      .setDescription('Set a member balance to an exact amount')
      .addUserOption(userOption(true))
      .addIntegerOption(amountOption(true, 0))
      .addStringOption(reasonOption()),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(EconomySubcommand.Reset)
      .setDescription('Reset a member balance to zero')
      .addUserOption(userOption(true))
      .addStringOption(reasonOption()),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(EconomySubcommand.Freeze)
      .setDescription('Pause or resume all earning and spending'),
    ),
  ],
  settings: [
   {
    category: SettingsCategory.Shop,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName(PluginName.Economy)
      .setDescription('Configure the server currency, earning and the role shop'),
    ],
   },
  ],
 });

 rewardsSchema = rewardsSchema;

 settingsSchema = {
  table: 'economySetting',
  rowKey: 'id',
  multiRow: false,
  title: (t: EconomyTranslator) => t.settings.configTitle(),
  overviewDescription: (t: EconomyTranslator) => t.settings.overviewDescription(),
  rowLabel: (t: EconomyTranslator) => t.settings.configTitle(),
  groups: [
   {
    id: EconomyGroups.General,
    label: (t: EconomyTranslator) => t.settings.groups.general(),
    fields: [
     {
      column: 'active',
      editor: EditorType.Boolean,
      label: (t: EconomyTranslator) => t.settings.fields.active(),
      description: (t: EconomyTranslator) => t.settings.descriptions.active(),
      headerToggle: true,
     },
     {
      column: 'frozen',
      editor: EditorType.Boolean,
      label: (t: EconomyTranslator) => t.settings.fields.frozen(),
      description: (t: EconomyTranslator) => t.settings.descriptions.frozen(),
     },
     {
      column: 'currencyName',
      editor: EditorType.String,
      label: (t: EconomyTranslator) => t.settings.fields.currencyName(),
      description: (t: EconomyTranslator) => t.settings.descriptions.currencyName(),
     },
     {
      column: 'currencyEmote',
      editor: EditorType.Emote,
      label: (t: EconomyTranslator) => t.settings.fields.currencyEmote(),
      description: (t: EconomyTranslator) => t.settings.descriptions.currencyEmote(),
     },
     {
      column: 'startBalance',
      editor: EditorType.Number,
      label: (t: EconomyTranslator) => t.settings.fields.startBalance(),
      description: (t: EconomyTranslator) => t.settings.descriptions.startBalance(),
     },
     {
      column: 'maxBalance',
      editor: EditorType.Number,
      label: (t: EconomyTranslator) => t.settings.fields.maxBalance(),
      description: (t: EconomyTranslator) => t.settings.descriptions.maxBalance(),
     },
     {
      column: 'confirmBuy',
      editor: EditorType.Boolean,
      label: (t: EconomyTranslator) => t.settings.fields.confirmBuy(),
      description: (t: EconomyTranslator) => t.settings.descriptions.confirmBuy(),
     },
     {
      column: 'balancePublic',
      editor: EditorType.Boolean,
      label: (t: EconomyTranslator) => t.settings.fields.balancePublic(),
      description: (t: EconomyTranslator) => t.settings.descriptions.balancePublic(),
     },
     {
      column: 'leaderboardPublic',
      editor: EditorType.Boolean,
      label: (t: EconomyTranslator) => t.settings.fields.leaderboardPublic(),
      description: (t: EconomyTranslator) => t.settings.descriptions.leaderboardPublic(),
     },
     {
      column: 'logChannels',
      editor: EditorType.Channels,
      label: (t: EconomyTranslator) => t.settings.fields.logChannels(),
      description: (t: EconomyTranslator) => t.settings.descriptions.logChannels(),
      arity: FieldArity.Multi,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildMedia],
     },
    ],
   },
   {
    id: EconomyGroups.Earning,
    label: (t: EconomyTranslator) => t.settings.groups.earning(),
    fields: [
     {
      column: 'messageActive',
      editor: EditorType.Boolean,
      label: (t: EconomyTranslator) => t.settings.fields.messageActive(),
      description: (t: EconomyTranslator) => t.settings.descriptions.messageActive(),
      headerToggle: true,
     },
     {
      column: 'messageAmount',
      editor: EditorType.Number,
      label: (t: EconomyTranslator) => t.settings.fields.messageAmount(),
      description: (t: EconomyTranslator) => t.settings.descriptions.messageAmount(),
     },
     {
      column: 'messageCooldown',
      editor: EditorType.Number,
      label: (t: EconomyTranslator) => t.settings.fields.messageCooldown(),
      description: (t: EconomyTranslator) => t.settings.descriptions.messageCooldown(),
     },
     {
      column: 'messageDailyCap',
      editor: EditorType.Number,
      label: (t: EconomyTranslator) => t.settings.fields.messageDailyCap(),
      description: (t: EconomyTranslator) => t.settings.descriptions.messageDailyCap(),
     },
     {
      column: 'minTenureHours',
      editor: EditorType.Number,
      label: (t: EconomyTranslator) => t.settings.fields.minTenureHours(),
      description: (t: EconomyTranslator) => t.settings.descriptions.minTenureHours(),
     },
    ],
   },
   {
    id: EconomyGroups.Filters,
    label: (t: EconomyTranslator) => t.settings.groups.filters(),
    fields: [
     {
      column: 'denyChannels',
      editor: EditorType.Channels,
      label: (t: EconomyTranslator) => t.settings.fields.denyChannels(),
      description: (t: EconomyTranslator) => t.settings.descriptions.denyChannels(),
      arity: FieldArity.Multi,
     },
     {
      column: 'denyRoles',
      editor: EditorType.Roles,
      label: (t: EconomyTranslator) => t.settings.fields.denyRoles(),
      description: (t: EconomyTranslator) => t.settings.descriptions.denyRoles(),
      arity: FieldArity.Multi,
     },
     {
      column: 'denyUsers',
      editor: EditorType.Users,
      label: (t: EconomyTranslator) => t.settings.fields.denyUsers(),
      description: (t: EconomyTranslator) => t.settings.descriptions.denyUsers(),
      arity: FieldArity.Multi,
     },
     {
      column: 'allowChannels',
      editor: EditorType.Channels,
      label: (t: EconomyTranslator) => t.settings.fields.allowChannels(),
      description: (t: EconomyTranslator) => t.settings.descriptions.allowChannels(),
      arity: FieldArity.Multi,
     },
     {
      column: 'allowRoles',
      editor: EditorType.Roles,
      label: (t: EconomyTranslator) => t.settings.fields.allowRoles(),
      description: (t: EconomyTranslator) => t.settings.descriptions.allowRoles(),
      arity: FieldArity.Multi,
     },
     {
      column: 'allowUsers',
      editor: EditorType.Users,
      label: (t: EconomyTranslator) => t.settings.fields.allowUsers(),
      description: (t: EconomyTranslator) => t.settings.descriptions.allowUsers(),
      arity: FieldArity.Multi,
     },
    ],
   },
   {
    id: EconomyGroups.Transfers,
    label: (t: EconomyTranslator) => t.settings.groups.transfers(),
    fields: [
     {
      column: 'transferActive',
      editor: EditorType.Boolean,
      label: (t: EconomyTranslator) => t.settings.fields.transferActive(),
      description: (t: EconomyTranslator) => t.settings.descriptions.transferActive(),
      headerToggle: true,
     },
     {
      column: 'transferMin',
      editor: EditorType.Number,
      label: (t: EconomyTranslator) => t.settings.fields.transferMin(),
      description: (t: EconomyTranslator) => t.settings.descriptions.transferMin(),
     },
     {
      column: 'transferMax',
      editor: EditorType.Number,
      label: (t: EconomyTranslator) => t.settings.fields.transferMax(),
      description: (t: EconomyTranslator) => t.settings.descriptions.transferMax(),
     },
     {
      column: 'transferDailyMax',
      editor: EditorType.Number,
      label: (t: EconomyTranslator) => t.settings.fields.transferDailyMax(),
      description: (t: EconomyTranslator) => t.settings.descriptions.transferDailyMax(),
     },
     {
      column: 'transferTax',
      editor: EditorType.Number,
      label: (t: EconomyTranslator) => t.settings.fields.transferTax(),
      description: (t: EconomyTranslator) => t.settings.descriptions.transferTax(),
     },
    ],
   },
   {
    id: EconomyGroups.Identity,
    label: (t: EconomyTranslator) => t.settings.groups.identity(),
    fields: [
     {
      column: 'botToken',
      editor: EditorType.BotToken,
      label: (t: EconomyTranslator) => t.settings.fields.botToken(),
      description: (t: EconomyTranslator) => t.settings.descriptions.botToken(),
      arity: FieldArity.Single,
      secret: true,
      transform: economyBotTokenTransform,
     },
     {
      column: 'profileNick',
      editor: EditorType.String,
      label: (t: EconomyTranslator) => t.settings.fields.profileNick(),
      description: (t: EconomyTranslator) => t.settings.descriptions.profileNick(),
      arity: FieldArity.Single,
      virtual: botProfileVirtual(BotProfilePart.Nick),
     },
     {
      column: 'profileAvatar',
      editor: EditorType.String,
      label: (t: EconomyTranslator) => t.settings.fields.profileAvatar(),
      description: (t: EconomyTranslator) => t.settings.descriptions.profileAvatar(),
      arity: FieldArity.Single,
      transform: botProfileImageTransform,
      virtual: botProfileVirtual(BotProfilePart.Avatar),
     },
     {
      column: 'profileBanner',
      editor: EditorType.String,
      label: (t: EconomyTranslator) => t.settings.fields.profileBanner(),
      description: (t: EconomyTranslator) => t.settings.descriptions.profileBanner(),
      arity: FieldArity.Single,
      transform: botProfileImageTransform,
      virtual: botProfileVirtual(BotProfilePart.Banner),
     },
     {
      column: 'profileBio',
      editor: EditorType.String,
      label: (t: EconomyTranslator) => t.settings.fields.profileBio(),
      description: (t: EconomyTranslator) => t.settings.descriptions.profileBio(),
      arity: FieldArity.Single,
      multiline: true,
      virtual: botProfileVirtual(BotProfilePart.Bio),
     },
    ],
   },
  ],
 } satisfies SettingsSchemaDef<
  EconomySetting & EconomyVirtualColumns,
  EconomyTranslator
 > as unknown as SettingsSchemaDef;
}
