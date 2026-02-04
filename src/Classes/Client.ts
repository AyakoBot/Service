import { logger as Logger, Cache } from '@ayako/utility';
import { API, GatewayDispatchEvents, type APIApplication } from '@discordjs/core';
import { REST } from '@discordjs/rest';

import GuildSetting from '../Plugins/settings/GuildSetting.js';

import type Plugin from './abstracts/Plugin.js';
import Database from './Database.js';
import JobCache from './JobCache.js';
import Metrics from './Metrics.js';
import SendMessageCache from './SendMessageCache.js';

const isDev = process.argv.includes('--dev');

export default class Client {
 rest = new REST({ api: 'http://127.0.0.1:8080/api' }).setToken(
  ((isDev ? process.env.DevToken : process.env.Token) ?? '').replace('Bot ', ''),
 );

 api = new API(this.rest);
 cache = new Cache(isDev ? 2 : 0, isDev ? 3 : 1, true);
 metrics = Metrics;
 logger: typeof Logger = Logger;
 db: Database;
 user: APIApplication | null = null;

 sendMessageCache: SendMessageCache;
 jobCache: typeof JobCache.prototype;
 languageCache: Map<string, string> = new Map();

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 plugins: Plugin<any>[] = [];

 constructor() {
  this.logger.log('[Client] Initializing Client...');
  this.logger.debug(
   '[Client] Running in',
   process.argv.includes('--dev') ? 'development' : 'production',
   'mode',
  );
  this.logger.debug(
   '[Client] Token start:',
   ((process.argv.includes('--dev') ? process.env.DevToken : process.env.Token) ?? '').split(
    '.',
   )[0],
  );
  this.logger.silly(`[Client] REST API endpoint: ${this.rest.options.api}`);

  this.logger.debug('[Client] Initializing Database...');
  this.db = new Database(this.logger, this.metrics, this.cache);
  this.sendMessageCache = new SendMessageCache(this);
  this.jobCache = new JobCache();

  this.logger.debug('[Client] Registering gateway event handlers...');
  const events = Object.keys(GatewayDispatchEvents);
  this.logger.silly('[Client] Registering', events.length, 'gateway events');
  events.forEach((e) => {
   this.cache.on(e, (...args: unknown[]) => this.logger.silly('[Event]', e, args));
  });

  this.api.applications.getCurrent().then((app) => {
   this.user = app;
  });

  this.logger.log('[Client] Client initialization complete');
 }

 registerPlugin = <E extends GatewayDispatchEvents>(
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PluginClass: new (client: Client) => Plugin<E>,
 ) => {
  const plugin = new PluginClass(this);

  const exists = this.plugins.find((p) => p.name === plugin.name);
  if (exists) return;

  this.plugins.push(plugin);
  this.logger.debug('[Client] Registered plugin:', plugin.name);
 };

 getLocale = async (guildIdOrLocale: bigint | undefined | null | string) => {
  if (!guildIdOrLocale) return 'en-GB';

  if (typeof guildIdOrLocale === 'string' && guildIdOrLocale.includes('-')) return guildIdOrLocale;

  const base = new GuildSetting(this.db, String(guildIdOrLocale));
  const setting = await base.get();

  return setting?.language || 'en-GB';
 };
}
