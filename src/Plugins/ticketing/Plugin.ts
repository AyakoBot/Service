import type { TicketSetting } from '@ayako/database';
import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { type GatewayDispatchEvents } from '@discordjs/core';

import Plugin, { idSelector, SettingsCategory } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';

import { EditorType } from '../settings/Plugin.js';

import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';
import messageDelete from './Events/MessageDelete/index.js';
import messageUpdate from './Events/MessageUpdate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events =
 | GatewayDispatchEvents.InteractionCreate
 | GatewayDispatchEvents.MessageCreate
 | GatewayDispatchEvents.MessageUpdate
 | GatewayDispatchEvents.MessageDelete;
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
  logMode: EditorType.TicketLogMode,
  allowCreatorClose: EditorType.Boolean,

  guild: EditorType.GuildId,
  id: EditorType.Id,
 };
}
