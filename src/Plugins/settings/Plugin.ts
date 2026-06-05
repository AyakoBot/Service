import { GatewayDispatchEvents } from '@discordjs/core';

import Plugin from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';

import interactionCreate from './Events/InteractionCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };

type Events = GatewayDispatchEvents.InteractionCreate;
type APILanguage = typeof en;

export default class SettingsPlugin extends Plugin<Events, APILanguage> {
 name = 'Settings';
 settingName = 'settings';
 tableName = '';

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {
  [GatewayDispatchEvents.InteractionCreate]: (data) => {
   if (
    !data.guild_id
     ? !this.client.debugUsers.includes(data.user?.id || '')
     : !this.client.debugGuilds.includes(data.guild_id || '')
   ) {
    return; // TODO: remove
   }

   interactionCreate.call(this, data);
  },
 } as Plugin<Events, APILanguage>['eventHandlers'];

 constructor(client: Client) {
  super(client);
 }

 getCommands = () => ({
  commands: [],
  settings: [],
 });
}

export { EditorType } from './EditorType.js';
