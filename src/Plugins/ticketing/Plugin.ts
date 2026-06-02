import type { TicketSetting } from '@ayako/database';
import { LogLevel } from '@ayako/utility';
import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { type GatewayDispatchEvents } from '@discordjs/core';

import Plugin, { idSelector, SettingsCategory } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import { EditorType } from '../settings/Plugin.js';

import channelDelete from './Events/ChannelDelete/index.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';
import messageDelete from './Events/MessageDelete/index.js';
import messageUpdate from './Events/MessageUpdate/index.js';
import threadDelete from './Events/ThreadDelete/index.js';
import threadUpdate from './Events/ThreadUpdate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events =
 | GatewayDispatchEvents.InteractionCreate
 | GatewayDispatchEvents.MessageCreate
 | GatewayDispatchEvents.MessageUpdate
 | GatewayDispatchEvents.MessageDelete
 | GatewayDispatchEvents.ThreadUpdate
 | GatewayDispatchEvents.ChannelDelete
 | GatewayDispatchEvents.ThreadDelete;
type APILanguage = typeof en;

export default class TicketPlugin extends Plugin<Events, APILanguage> {
 name = 'Ticketing';
 settingName = 'ticketing';
 tableName = 'TicketSetting';

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

  this.logger.setLevel(LogLevel.silly);
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
  transcriptChannels: EditorType.Channels,
  mentionRoles: EditorType.Roles,
  mentionUsers: EditorType.Users,
  staffRoles: EditorType.Roles,
  staffUsers: EditorType.Users,
  sendMessagePrefixes: EditorType.String,
  type: EditorType.TicketType,
  createTags: EditorType.Strings,
  claimTags: EditorType.Strings,
  closeTags: EditorType.Strings,
  tagClaimer: EditorType.Boolean,
  logMode: EditorType.TicketLogMode,
  allowCreatorClose: EditorType.Boolean,
  staffThreads: EditorType.Boolean,
  staffThreadsChannel: EditorType.Channel,

  guild: EditorType.GuildId,
  id: EditorType.Id,
 };
}
