import { GatewayDispatchEvents, PermissionFlagsBits } from '@discordjs/core';

import Plugin, { PluginName } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';

import interactionCreate from './Events/InteractionCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };
import type { ResolvedSchema, SettingsDelegate } from './SettingsSchema.js';
import cutoverGate from './Util/cutoverGate.js';

type Events = GatewayDispatchEvents.InteractionCreate;
type APILanguage = typeof en;

export default class SettingsPlugin extends Plugin<Events, APILanguage> {
 name = 'Settings';
 settingName = PluginName.Settings;
 tableName = '';

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

 eventHandlers = {
  [GatewayDispatchEvents.InteractionCreate]: (data) => {
   if (!cutoverGate.call(this, data)) return; // TODO: remove

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

 resolveSchema = (settingName: string): ResolvedSchema | null => {
  const plugin = this.client.plugins.find((p) => p.settingName === settingName);
  if (!plugin || !plugin.settingsSchema) return null;
  return { plugin, schema: plugin.settingsSchema };
 };

 tableClient = (table: string): SettingsDelegate =>
  (this.client.db.client as unknown as Record<string, SettingsDelegate>)[table];
}

export { EditorType } from './EditorType.js';
