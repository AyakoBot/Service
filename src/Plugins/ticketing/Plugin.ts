import { type GatewayDispatchEvents } from '@discordjs/core';

import Plugin, { idSelector, SettingsCategory } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';

import en from './Language/en-GB.json' with { type: 'json' };
import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import type { TicketSetting } from '@ayako/database';
import { EditorType } from '../settings/Plugin.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';

type Events = GatewayDispatchEvents.MessageCreate | GatewayDispatchEvents.InteractionCreate;
type APILanguage = typeof en;

export default class TicketPlugin extends Plugin<Events, APILanguage> {
 name = 'Ticketing';
 settingName = 'ticketing';
 tableName = 'TicketSetting';

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {
  MESSAGE_CREATE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove
   if (!this.isEnabled()) return;

   messageCreate.call(this, data);
  },
  INTERACTION_CREATE: (data) => {
   if (!this.client.debugGuilds.includes(data.guild_id || '')) return; // TODO: remove
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
 } as Plugin<Events, APILanguage>['eventHandlers'];

 constructor(client: Client) {
  super(client);
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

 settingsEditorTypes: Record<keyof TicketSetting, EditorType> = {
  active: EditorType.Boolean,
  archiveCategory: EditorType.Category,
  archiveDuration: EditorType.Duration,
  category: EditorType.Category,
  channel: EditorType.Channel,
  denyRoles: EditorType.Roles,
  denyUsers: EditorType.Users,
  logChannels: EditorType.Channels,
  mentionRoles: EditorType.Roles,
  mentionUsers: EditorType.Users,
  sendMessagePrefixes: EditorType.String,
  type: EditorType.TicketType,
  appliedTags: EditorType.Strings,

  guild: EditorType.GuildId,
  id: EditorType.Id,
 };
}
