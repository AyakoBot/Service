import {
 SlashCommandBuilder,
 SlashCommandStringOption,
 SlashCommandSubcommandBuilder,
} from '@discordjs/builders';
import {
 ApplicationIntegrationType,
 InteractionContextType,
 PermissionFlagsBits,
 type GatewayDispatchEvents,
} from '@discordjs/core';

import Plugin, { PluginName } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';

import ReminderEngine from './Classes/ReminderEngine.js';
import { commandName, ReminderOption, ReminderSub } from './Classes/Routes.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.InteractionCreate;

type RemindersLanguage = typeof en;

const contentOption = () =>
 new SlashCommandStringOption()
  .setName(ReminderOption.Content)
  .setDescription('What to remind you of')
  .setMaxLength(2000)
  .setRequired(true);

const idOption = () =>
 new SlashCommandStringOption()
  .setName(ReminderOption.Id)
  .setDescription('The ID of the Reminder')
  .setRequired(true)
  .setAutocomplete(true);

export default class RemindersPlugin extends Plugin<Events, RemindersLanguage> {
 name = 'Reminders';
 settingName = PluginName.Reminders;
 tableName = '';

 customBotPerms = PermissionFlagsBits.SendMessages;

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
 } as Plugin<Events, RemindersLanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 engine = new ReminderEngine(this);

 constructor(client: Client) {
  super(client);

  this.client.cache.on('scheduleExpired', (key: unknown) =>
   this.engine.onScheduleExpired(String(key)),
  );
  this.engine.reconcile().catch((e: Error) => this.nonFatalError(e, 'reconcileSchedules'));
 }

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName(commandName)
    .setDescription('Set Reminders to be reminded of later')
    .setContexts([
     InteractionContextType.Guild,
     InteractionContextType.BotDM,
     InteractionContextType.PrivateChannel,
    ])
    .setIntegrationTypes([
     ApplicationIntegrationType.GuildInstall,
     ApplicationIntegrationType.UserInstall,
    ])
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(ReminderSub.Create)
      .setDescription('Create a Reminder')
      .addStringOption(
       new SlashCommandStringOption()
        .setName(ReminderOption.Duration)
        .setDescription('When to remind you (e.g. 1d 12h)')
        .setMaxLength(50)
        .setRequired(true),
      )
      .addStringOption(contentOption()),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(ReminderSub.List)
      .setDescription('List your Reminders'),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(ReminderSub.Edit)
      .setDescription('Edit the Content of a Reminder')
      .addStringOption(idOption())
      .addStringOption(contentOption()),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(ReminderSub.Delete)
      .setDescription('Delete a Reminder')
      .addStringOption(idOption()),
    ),
  ],
  settings: [],
 });
}
