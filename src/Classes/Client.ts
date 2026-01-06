import { API, GatewayDispatchEvents } from '@discordjs/core';
import { REST } from '@discordjs/rest';

import GuildSetting from '../Plugins/settings/GuildSetting.js';

import type Plugin from './abstracts/Plugin.js';
import Cache from './Cache.js';
import Database from './Database.js';
import JobCache from './JobCache.js';
import Logger from './Logger.js';
import Metrics from './Metrics.js';
import SendMessageCache from './SendMessageCache.js';

const token = (
 (process.argv.includes('--dev') ? process.env.DevToken : process.env.Token) ?? ''
).replace('Bot ', '');

export default class Client {
 rest = new REST({ api: 'http://127.0.0.1:8080/api' }).setToken(token);
 api = new API(this.rest);
 cache = Cache;
 metrics = Metrics;
 logger = Logger;
 db: Database;

 sendMessageCache: SendMessageCache;
 jobCache: typeof JobCache.prototype;
 languageCache: Map<string, string> = new Map();

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 plugins: Plugin<any>[] = [];

 constructor() {
  Logger.log('[Client] Initializing Client...');
  Logger.debug(
   '[Client] Running in',
   process.argv.includes('--dev') ? 'development' : 'production',
   'mode',
  );
  Logger.silly(`[Client] REST API endpoint: ${this.rest.options.api}`);

  Logger.debug('[Client] Initializing Database...');
  this.db = new Database(this.logger, this.metrics, this.cache);
  this.sendMessageCache = new SendMessageCache(this);
  this.jobCache = new JobCache();

  Logger.debug('[Client] Registering gateway event handlers...');
  const events = Object.keys(GatewayDispatchEvents);
  Logger.silly('[Client] Registering', events.length, 'gateway events');
  events.forEach((e) => {
   this.cache.on(e, (...args: unknown[]) => this.logger.silly('[Event]', e, args));
  });

  Logger.log('[Client] Client initialization complete');
 }

 registerPlugin = <E extends GatewayDispatchEvents>(
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PluginClass: new (client: Client) => Plugin<E>,
 ) => {
  const plugin = new PluginClass(this);

  const exists = this.plugins.find((p) => p.name === plugin.name);
  if (exists) return;

  this.plugins.push(plugin);
  Logger.debug('[Client] Registered plugin:', plugin.name);
 };

 getLocale = async (guildIdOrLocale: bigint | undefined | null | string) => {
  if (!guildIdOrLocale) return 'en-GB';

  if (typeof guildIdOrLocale === 'string' && guildIdOrLocale.includes('-')) return guildIdOrLocale;

  const base = new GuildSetting(this.db, String(guildIdOrLocale));
  const setting = await base.get();

  return setting?.language || 'en-GB';
 };
}
