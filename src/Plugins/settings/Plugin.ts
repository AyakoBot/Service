import type { API } from '@ayako/api';
import { SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { type GatewayDispatchEvents } from '@discordjs/core';

import Plugin from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';

import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.MessageCreate | GatewayDispatchEvents.InteractionCreate;
type APILanguage = typeof en;

export default class AFKPlugin extends Plugin<Events, APILanguage> {
 name = 'AFK';
 apiCache: Map<string, typeof API> = new Map();

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {} as Plugin<Events, APILanguage>['eventHandlers'];

 constructor(client: Client) {
  super(client);
  // Init cc apis
 }

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
