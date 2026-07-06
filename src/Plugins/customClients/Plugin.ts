import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { GatewayDispatchEvents, PermissionFlagsBits } from '@discordjs/core';

import Plugin, { PluginName } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';

import CustomClient from './CustomClient.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.MessageCreate | GatewayDispatchEvents.InteractionCreate;
type APILanguage = typeof en;

export default class CustomClientsPlugin extends Plugin<Events, APILanguage> {
 name = 'Custom Clients';
 settingName = PluginName.CustomClients;
 tableName = 'CustomClient';

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.ReadMessageHistory;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {} as Plugin<Events, APILanguage>['eventHandlers'];

 constructor(client: Client) {
  super(client);
  client.getAPI = this.getApiFromGuildId;
  client.getCustomAPI = this.getCustomApiFromGuildId;
  client.getBotIdForGuildId = this.getBotIdForGuildId;

  this.client.cache.on('interaction', (message) => {
   this.logger.silly('[CustomClientsPlugin] Received interaction event:', message);
   this.client.cache.emit(GatewayDispatchEvents.InteractionCreate, message);
  });
 }

 getApiFromGuildId = async (guildId?: string) => {
  if (!guildId) return this.client.getBaseAPI();
  const ccBase = new CustomClient(this.client, guildId);
  return ccBase.getAPIforGuildId(guildId);
 };

 getCustomApiFromGuildId = async (guildId?: string) => {
  if (!guildId) return null;
  const ccBase = new CustomClient(this.client, guildId);
  return ccBase.getCustomAPIforGuildId(guildId);
 };

 getBotIdForGuildId = async (guildId: string) => {
  const ccBase = new CustomClient(this.client, guildId);
  return ccBase.getBotIdForGuildId(guildId);
 };

 onGuildRemoved = async (guildId: string) => {
  await this.client.db.client.customClient.updateMany({
   where: { guildId },
   data: { token: null },
  });

  const ccBase = new CustomClient(this.client, guildId);
  ccBase.apiCache.delete(guildId);
  this.invalidateGuildAPI(guildId);
 };

 getEmojiSyncTokens = async (): Promise<string[]> => {
  const rows = await this.client.db.client.customClient.findMany({
   where: { token: { not: null } },
   select: { token: true },
  });

  return rows.map((row) => row.token).filter((token): token is string => Boolean(token));
 };

 getCommands = () => ({
  commands: [],
  settings: [
   {
    category: null,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName('custom-clients')
      .setDescription("Change Ayako's appearance using your own Bot Client"),
    ],
   },
  ],
 });
}
