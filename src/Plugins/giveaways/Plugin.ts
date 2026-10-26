import { decrypt, SatelliteChannel } from '@ayako/utility';
import {
 SlashCommandBooleanOption,
 SlashCommandBuilder,
 SlashCommandChannelOption,
 SlashCommandIntegerOption,
 SlashCommandRoleOption,
 SlashCommandStringOption,
 SlashCommandSubcommandBuilder,
 SlashCommandSubcommandGroupBuilder,
 SlashCommandUserOption,
} from '@discordjs/builders';
import {
 ApplicationIntegrationType,
 InteractionContextType,
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
import { PluginBotKey } from '../../Util/pluginBotKey.js';
import type { TranslatorType } from '../../Util/translator.js';
import { assertSchemaValid } from '../settings/SettingsSchema.js';

import ActivityTracker from './Classes/ActivityTracker.js';
import { GiveawayErrors } from './Classes/DBGiveaway.js';
import GiveawayEngine from './Classes/GiveawayEngine.js';
import GiveawayLauncher from './Classes/GiveawayLauncher.js';
import GiveawayLogger from './Classes/GiveawayLogger.js';
import GiveawayPrizes from './Classes/GiveawayPrizes.js';
import GiveawayRewards from './Classes/GiveawayRewards.js';
import GiveawayTemplates from './Classes/GiveawayTemplates.js';
import PrizePanel from './Classes/PrizePanel.js';
import {
 commandName,
 GiveawayGroup,
 GiveawayOption,
 GiveawaySettingName,
 GiveawayStartSub,
 GiveawaySub,
} from './Classes/Routes.js';
import settingsSchema from './Classes/settingsSchema.js';
import templateSchema from './Classes/templateSchema.js';
import { giveawayChannelTypes, giveawayPlaceholders } from './constants.js';
import channelDelete from './Events/ChannelDelete/index.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';
import messageDelete from './Events/MessageDelete/index.js';
import messageDeleteBulk from './Events/MessageDeleteBulk/index.js';
import en from './Language/en-GB.json' with { type: 'json' };
import { giveawayDefaults } from './Util/giveawayDefaults.js';
import { missingDefaultsText } from './Util/missingDefaults.js';

type Events =
 | GatewayDispatchEvents.InteractionCreate
 | GatewayDispatchEvents.MessageCreate
 | GatewayDispatchEvents.MessageDelete
 | GatewayDispatchEvents.MessageDeleteBulk
 | GatewayDispatchEvents.ChannelDelete
 | GatewayDispatchEvents.ThreadDelete;

type GiveawaysLanguage = typeof en;
export type GiveawaysTranslator = TranslatorType<GiveawaysLanguage> & { base: BaseLang };

const descriptionOption = (required: boolean) =>
 new SlashCommandStringOption()
  .setName(GiveawayOption.Description)
  .setDescription('What is being given away')
  .setMaxLength(2000)
  .setRequired(required);

const timeOption = () =>
 new SlashCommandStringOption()
  .setName(GiveawayOption.Time)
  .setDescription('How long the giveaway runs, for example 1d 12h')
  .setMaxLength(50)
  .setRequired(false);

const winnersOption = () =>
 new SlashCommandIntegerOption()
  .setName(GiveawayOption.Winners)
  .setDescription('How many winners to draw')
  .setMinValue(1)
  .setMaxValue(100)
  .setRequired(false);

const channelOption = () =>
 new SlashCommandChannelOption()
  .setName(GiveawayOption.Channel)
  .setDescription('The channel the giveaway is posted in (defaults to here)')
  .addChannelTypes(...giveawayChannelTypes)
  .setRequired(false);

const roleOption = () =>
 new SlashCommandRoleOption()
  .setName(GiveawayOption.Role)
  .setDescription('Role required to enter')
  .setRequired(false);

const hostOption = () =>
 new SlashCommandUserOption()
  .setName(GiveawayOption.Host)
  .setDescription('The host of the giveaway (defaults to you)')
  .setRequired(false);

const prizeOption = () =>
 new SlashCommandStringOption()
  .setName(GiveawayOption.Prize)
  .setDescription('The prize winners claim with a button')
  .setMaxLength(1024)
  .setRequired(false);

const claimTimeoutOption = () =>
 new SlashCommandStringOption()
  .setName(GiveawayOption.ClaimTimeout)
  .setDescription('How long winners have to claim their prize (at least 1 hour)')
  .setMaxLength(50)
  .setRequired(false);

const failRerollOption = () =>
 new SlashCommandBooleanOption()
  .setName(GiveawayOption.FailReroll)
  .setDescription('Reroll winners who do not claim in time')
  .setRequired(false);

const messageIdOption = () =>
 new SlashCommandStringOption()
  .setName(GiveawayOption.MessageId)
  .setDescription('The message ID of the giveaway')
  .setRequired(true)
  .setAutocomplete(true);

const templateOption = () =>
 new SlashCommandStringOption()
  .setName(GiveawayOption.Template)
  .setDescription('The template to start, set up in /settings fun giveaway-templates')
  .setRequired(true)
  .setAutocomplete(true);

const withQuickOptions = (sub: SlashCommandSubcommandBuilder, withChannel: boolean) => {
 sub.addStringOption(timeOption()).addIntegerOption(winnersOption());
 if (withChannel) sub.addChannelOption(channelOption());

 return sub
  .addRoleOption(roleOption())
  .addUserOption(hostOption())
  .addStringOption(prizeOption())
  .addStringOption(claimTimeoutOption())
  .addBooleanOption(failRerollOption());
};

const quickSubcommand = (name: string) =>
 withQuickOptions(
  new SlashCommandSubcommandBuilder()
   .setName(name)
   .setDescription('Start a giveaway')
   .addStringOption(descriptionOption(true)),
  true,
 );

const startGroup = () =>
 new SlashCommandSubcommandGroupBuilder()
  .setName(GiveawayGroup.Start)
  .setDescription('Start a giveaway')
  .addSubcommand(quickSubcommand(GiveawayStartSub.Default))
  .addSubcommand(
   new SlashCommandSubcommandBuilder()
    .setName(GiveawayStartSub.FromTemplate)
    .setDescription('Start a giveaway from a template')
    .addStringOption(templateOption())
    .addChannelOption(channelOption())
    .addStringOption(descriptionOption(false))
    .addStringOption(prizeOption())
    .addStringOption(timeOption())
    .addIntegerOption(winnersOption()),
  );

export default class GiveawaysPlugin extends Plugin<Events, GiveawaysLanguage> {
 name = 'Giveaways';
 settingName = PluginName.Giveaways;
 dependencies = [PluginName.Settings, PluginName.EmbedBuilder, PluginName.ComponentBuilder];
 tableName = 'GiveawaySetting';

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.ManageRoles;

 placeholders = giveawayPlaceholders;

 settingsSchema = settingsSchema;

 extraSchemas = { [GiveawaySettingName.Templates]: templateSchema };

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };

 eventHandlers = {
  INTERACTION_CREATE: (data) => {
   if (!this.isLiveFor(data.guild_id ?? '')) return;
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
  MESSAGE_CREATE: (data) => {
   if (!this.isLiveFor(data.guild_id ?? '')) return;
   if (!this.isEnabled()) return;

   messageCreate.call(this, data);
  },
  MESSAGE_DELETE: (data) => {
   if (!this.isLiveFor(data.guild_id ?? '')) return;
   if (!this.isEnabled()) return;

   messageDelete.call(this, data);
  },
  MESSAGE_DELETE_BULK: (data) => {
   if (!this.isLiveFor(data.guild_id ?? '')) return;
   if (!this.isEnabled()) return;

   messageDeleteBulk.call(this, data);
  },
  CHANNEL_DELETE: (data) => {
   if (!this.isLiveFor(data.guild_id ?? '')) return;
   if (!this.isEnabled()) return;

   channelDelete.call(this, data);
  },
  THREAD_DELETE: (data) => {
   if (!this.isLiveFor(data.guild_id ?? '')) return;
   if (!this.isEnabled()) return;

   channelDelete.call(this, data);
  },
 } as Plugin<Events, GiveawaysLanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 logs = new GiveawayLogger(this);
 activity = new ActivityTracker(this);
 engine = new GiveawayEngine(this);
 prizes = new GiveawayPrizes(this);
 rewards = new GiveawayRewards(this);
 templates = new GiveawayTemplates(this);
 launcher = new GiveawayLauncher(this);
 panel = new PrizePanel(this);

 constructor(client: Client) {
  super(client);

  this.pluginBotKey = PluginBotKey.Giveaways;
  assertSchemaValid(this.settingsSchema);
  assertSchemaValid(templateSchema);

  this.client.cache.on('scheduleExpired', (key: unknown) => {
   this.engine.onScheduleExpired(String(key));
   this.templates.onScheduleExpired(String(key));
  });
  this.engine.reconcile().catch((e: Error) => this.nonFatalError(e, 'reconcileSchedules'));
  this.templates.reconcile().catch((e: Error) => this.nonFatalError(e, 'reconcileTemplates'));
  this.syncMainCommand().catch((e: Error) => this.nonFatalError(e, 'syncMainCommand'));
  this.activity.start();
 }

 api = async (guildId: string) =>
  this.getAPI(guildId, (await giveawayDefaults.call(this, guildId)).botToken);

 errorText = async (guildId: string, error: Error): Promise<string> => {
  const t = await this.t(guildId);
  if (error.message === GiveawayErrors.missingDefaults) {
   return missingDefaultsText.call(this, t, guildId, error);
  }
  if (Object.keys(t.errors).includes(error.message)) {
   return t.errors[error.message as keyof typeof t.errors]();
  }

  this.nonFatalError(error, 'giveawayError');
  return t.base.errors.unknownError();
 };

 getEmojiSyncTokens = async (): Promise<string[]> => {
  const rows = await this.client.db.client.giveawaySetting.findMany({
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

 reconcileSatellites = () => {
  this.client.cache.cachePub
   .publish(SatelliteChannel.Reconcile, '')
   .catch((e: Error) => this.nonFatalError(e, 'reconcileSatellites'));
 };

 invalidateToken = async (cipher: string): Promise<void> => {
  await this.client.db.client.giveawaySetting.updateMany({
   where: { botToken: cipher },
   data: { botToken: null },
  });
 };

 getCustomBotTargets = async (): Promise<Array<{ token: string; guildId: string }>> => {
  const rows = await this.client.db.client.giveawaySetting.findMany({
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

 onGuildRemoved = async (guildId: string) => {
  const where = { guild: guildId };

  this.activity.forgetGuild(guildId);

  await this.client.db.client.giveaway.deleteMany({ where });
  await this.client.db.client.giveawaySetting.deleteMany({ where });
  await this.client.db.client.giveawayTemplate.deleteMany({ where });
  await this.client.db.client.giveawayActivity.deleteMany({ where });
 };

 syncMainCommand = async () => {
  const command = this.getCommands().commands.find((entry) => entry.name === commandName);
  if (!command) return;

  await this.client.getBaseAPI().applicationCommands.createGlobalCommand(command.toJSON(), {
   origin: this.name,
   reason: 'Registering the v3 giveaway command on the main bot',
  });
 };

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName(commandName)
    .setDescription('Host giveaways in this server')
    .setContexts([InteractionContextType.Guild])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(quickSubcommand(GiveawaySub.Quick))
    .addSubcommandGroup(startGroup())
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(GiveawaySub.End)
      .setDescription('End a giveaway early and draw the winners')
      .addStringOption(messageIdOption()),
    )
    .addSubcommand(
     withQuickOptions(
      new SlashCommandSubcommandBuilder()
       .setName(GiveawaySub.Edit)
       .setDescription('Edit a giveaway')
       .addStringOption(messageIdOption())
       .addStringOption(descriptionOption(false)),
      false,
     ),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(GiveawaySub.Reroll)
      .setDescription('Redraw the winners of an ended giveaway')
      .addStringOption(messageIdOption()),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(GiveawaySub.Cancel)
      .setDescription('Cancel a giveaway without drawing winners')
      .addStringOption(messageIdOption()),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(GiveawaySub.List)
      .setDescription('List the giveaways of this server'),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(GiveawaySub.Prizes)
      .setDescription('Set the prize and give each winner a personal one, such as a game key')
      .addStringOption(messageIdOption()),
    ),
  ],
  settings: [
   {
    category: SettingsCategory.Fun,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName(PluginName.Giveaways)
      .setDescription('Configure giveaway defaults, tracking and the giveaway bot'),
     new SlashCommandSubcommandBuilder()
      .setName(GiveawaySettingName.Templates)
      .setDescription('Set up reusable and recurring giveaways')
      .addStringOption(idSelector),
    ],
   },
  ],
 });
}
