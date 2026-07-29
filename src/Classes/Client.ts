import { API as CustomAPI } from '@ayako/api';
import { Cache, logger as Logger } from '@ayako/utility';
import { API, GatewayDispatchEvents, type APIApplication } from '@discordjs/core';
import { REST } from '@discordjs/rest';

import GuildSetting from '../Plugins/settings/GuildSetting.js';

import type Plugin from './abstracts/Plugin.js';
import type { BaseLanguage } from './abstracts/Plugin.js';
import Database from './Database.js';
import EmojiRegistry from './EmojiRegistry.js';
import JobCache from './JobCache.js';
import Metrics from './Metrics.js';
import SendMessageCache from './SendMessageCache.js';

export default class Client {
 isDev = process.argv.includes('--dev');

 cache = new Cache(0, 1, true);
 logger: typeof Logger = Logger;

 private api = new API(
  new REST({
   api: `http://${process.argv.includes('--local') ? 'localhost' : 'nirn'}:8080/api`,
  }).setToken((this.isDev ? process.env.DevToken : process.env.Token)!.replace('Bot ', '')),
 );

 metrics = Metrics;
 db: Database;
 user: APIApplication | null = null;

 debugGuilds = ['298954459172700181', '669893888856817665', '672546390915940405', '1518697272525979648', '1499475512911859763'];
 debugUsers = ['318453143476371456', '564052925828038658', '669915074458025984', '1463063234343862437'];

 sendMessageCache: SendMessageCache;
 jobCache: typeof JobCache.prototype;
 languageCache: Map<string, string> = new Map();

 plugins: Plugin<GatewayDispatchEvents, BaseLanguage>[] = [];

 emojis = new EmojiRegistry(this);

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
   .getCurrent()
   .then((app) => {
    this.user = app;
   })
   .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`Failed to fetch application info during client initialization: ${err}`);
   });

  this.logger.log('[Client] Client initialization complete');
 }

 registerPlugin = <E extends GatewayDispatchEvents>(
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PluginClass: new (client: Client) => Plugin<E, BaseLanguage>,
 ) => {
  const plugin = new PluginClass(this);

  const exists = this.plugins.find((p) => p.constructor.name === PluginClass.name);
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

 getAPI = async (guildId: string) => this.getBaseAPI(guildId);
 getCustomAPI = async (_guildId: string): Promise<CustomAPI | null> => null;
 getBaseAPI = (guildId = 'this should never appear in logs') =>
  new CustomAPI(
   (this.isDev ? process.env.DevToken : process.env.Token)!.replace('Bot ', ''),
   this.logger,
   this.cache,
   guildId,
  );

 getTokenAPI = (token: string, guildId = 'register-token-api') =>
  new CustomAPI(token.replace('Bot ', ''), this.logger, this.cache, guildId);

 getBotIdForGuildId = async (_guildId: string) => this.user?.id || '';
}
