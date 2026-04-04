import { API, RequestHandlerError } from '@ayako/api';
import { Cache, logger as Logger } from '@ayako/utility';
import { GatewayDispatchEvents, type APIApplication } from '@discordjs/core';

import GuildSetting from '../Plugins/settings/GuildSetting.js';

import type Plugin from './abstracts/Plugin.js';
import type { BaseLanguage } from './abstracts/Plugin.js';
import Database from './Database.js';
import JobCache from './JobCache.js';
import Metrics from './Metrics.js';
import SendMessageCache from './SendMessageCache.js';

const isDev = process.argv.includes('--dev');
const token = (isDev ? process.env.DevToken : process.env.Token) || '';

export default class Client {
 cache = new Cache(0, 1, true);
 // TODO: reenable this
 // cache = new Cache(isDev ? 2 : 0, isDev ? 3 : 1, true);
 logger: typeof Logger = Logger;
 private api = new API(
  token.replace('Bot ', ''),
  this.logger,
  this.cache,
  Buffer.from(token.split('.')[0].replace('Bot ', ''), 'base64').toString(),
 );

 metrics = Metrics;
 db: Database;
 user: APIApplication | null = null;

 debugGuilds = ['298954459172700181', '669893888856817665', '672546390915940405'];

 sendMessageCache: SendMessageCache;
 jobCache: typeof JobCache.prototype;
 languageCache: Map<string, string> = new Map();

 plugins: Plugin<GatewayDispatchEvents, BaseLanguage>[] = [];

 constructor() {
  this.api.on('error', (err) => {
   this.logger.error('[BASE API] API Error:', err);
  });

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

  this.logger.debug('[Client] Initializing Database...');
  this.db = new Database(this.logger, this.metrics, this.cache);
  this.sendMessageCache = new SendMessageCache(this);
  this.jobCache = new JobCache();

  this.logger.debug('[Client] Registering gateway event handlers...');
  const events = Object.values(GatewayDispatchEvents);

  this.logger.silly('[Client] Registering', events.length, 'gateway events');

  events.forEach((e) => {
   this.logger.silly('[Client] Registering', e, 'gateway event');
   this.cache.on(e, (...args: unknown[]) => this.logger.silly('[Event]', e, args));
  });

  this.api.applications
   .getCurrent({
    origin: 'Client Initialization',
    reason: 'Fetch bot application info on startup',
   })
   .then((app) => {
    if (app instanceof RequestHandlerError) {
     throw new Error(`Failed to fetch application info during client initialization: ${app.debug}`);
    }

    this.user = app;
   });

  this.logger.log('[Client] Client initialization complete');
 }

 registerPlugin = <E extends GatewayDispatchEvents>(
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PluginClass: new (client: Client) => Plugin<E, BaseLanguage>,
 ) => {
  const plugin = new PluginClass(this);

  const exists = this.plugins.find((p) => p.name === PluginClass.name);
  if (exists) return;

  this.plugins.push(plugin as Plugin<GatewayDispatchEvents, BaseLanguage>);
  this.logger.debug('[Client] Registered plugin:', plugin.name);
  plugin.registerEvents();
 };

 getLocale = async (guildIdOrLocale: bigint | undefined | null | string) => {
  if (!guildIdOrLocale) return 'en-GB';

  if (typeof guildIdOrLocale === 'string' && guildIdOrLocale.includes('-')) return guildIdOrLocale;

  const base = new GuildSetting(this, String(guildIdOrLocale));
  const setting = await base.get();

  return setting?.language || 'en-GB';
 };

 getAPI = async (_guildId?: string) => this.api;
 getBaseAPI = (): API => this.api;
 getBotIdForGuildId = async (_guildId: string) => this.user?.id || '';
}
