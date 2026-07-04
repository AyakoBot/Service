import { GatewayDispatchEvents, PermissionFlagsBits } from '@discordjs/core';

import Plugin, { PluginName } from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import type { ExtractPayload } from '../../Types/gateway.js';

import AutoModerationActionExecution from './Events/AutoModerationActionExecution/index.js';

type Events = GatewayDispatchEvents.AutoModerationActionExecution;

export default class FilterScraperPlugin extends Plugin<Events, never> {
 name = 'Filter Scraper';
 settingName = PluginName.FilterScraper;
 tableName = '';

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.ManageMessages |
  PermissionFlagsBits.ReadMessageHistory;

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': {} as never,
 };
 /* eslint-enable @typescript-eslint/naming-convention */

 eventHandlers = {
  [GatewayDispatchEvents.AutoModerationActionExecution]: (
   data: ExtractPayload<GatewayDispatchEvents.AutoModerationActionExecution>,
  ) => {
   this.logger.debug('[FilterScraperPlugin] AutoModerationActionExecution event received');
   if (!this.isEnabled()) return;
   this.logger.debug('[FilterScraperPlugin] Processing AutoModerationActionExecution event');

   AutoModerationActionExecution.call(this, data);
  },
 };

 constructor(client: Client) {
  super(client);
 }

 getCommands = () => ({
  commands: [],
  settings: [],
 });
}
