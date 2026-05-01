import { type GatewayDispatchEvents } from '@discordjs/core';

import Plugin from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';

import messageCreate from './Events/MessageCreate/index.js';

type Events = GatewayDispatchEvents.MessageCreate;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type APILanguage = {};

export default class EvalPlugin extends Plugin<Events, APILanguage> {
 name = 'Eval';
 settingName = 'eval';
 tableName = '';

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': {},
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MESSAGE_CREATE: (data) => {
   if (data.author.id !== '318453143476371456') return;
   if (!data.content.startsWith('seval')) return;
   if (!this.isEnabled()) return;

   messageCreate.call(this, data);
  },
 } as Plugin<Events, APILanguage>['eventHandlers'];

 constructor(client: Client) {
  super(client);
 }

 getCommands = () => ({
  commands: [],
  settings: [],
 });

 settingsEditorTypes = {};
}
