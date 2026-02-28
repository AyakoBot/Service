import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { type GatewayDispatchEvents } from '@discordjs/core';

import Plugin from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';

import CustomClient from './CustomClient.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.MessageCreate | GatewayDispatchEvents.InteractionCreate;
type APILanguage = typeof en;

export default class SettingsPlugin extends Plugin<Events, APILanguage> {
 name = 'Settings';

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {} as Plugin<Events, APILanguage>['eventHandlers'];

 constructor(client: Client) {
  super(client);
  client.getAPI = this.getApiFromGuildId;
  client.getBotIdForGuildId = this.getBotIdForGuildId;
 }

 getApiFromGuildId = async (guildId?: string) => {
  if (!guildId) return this.client.getBaseAPI();
  const ccBase = new CustomClient(this.client, guildId);
  return ccBase.getAPIforGuildId(guildId);
 };

 getBotIdForGuildId = async (guildId: string) => {
  const ccBase = new CustomClient(this.client, guildId);
  return ccBase.getBotIdForGuildId(guildId);
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
