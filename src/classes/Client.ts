import { API, GatewayDispatchEvents } from '@discordjs/core';
import { REST } from '@discordjs/rest';

import GuildSetting from '../plugins/settings/GuildSetting.js';

import type Plugin from './abstracts/Plugin.js';
import Cache from './Cache.js';
import Database from './Database.js';
import JobCache from './JobCache.js';
import { Language } from './Language.js';
import Logger from './Logger.js';
import Metrics from './Metrics.js';
import SendMessageCache from './SendMessageCache.js';

const token = (
 (process.argv.includes('--dev') ? process.env.DevToken : process.env.Token) ?? ''
).replace('Bot ', '');

export default class Client {
 readonly rest = new REST({ api: 'http://127.0.0.1:8080/api' }).setToken(token);
 readonly api = new API(this.rest);
 readonly cache = Cache;
 readonly metrics = Metrics;
 readonly logger = Logger;
 readonly db: Database;

 readonly sendMessageCache: SendMessageCache;
 readonly jobCache: typeof JobCache.prototype;
 readonly languageCache: { [key in keyof typeof Language.languages]?: Language } = {};

 readonly plugins: Plugin[] = [];

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

 registerPlugin = (plugin: Plugin) => {
  this.plugins.push(plugin);
  Logger.debug('[Client] Registered plugin:', plugin.name);
 };

 private getLanguageForLocale = (lang: keyof typeof Language.languages = 'en-GB') => {
  if (this.languageCache[lang]) return this.languageCache[lang];

  return new Language(lang, this.cache);
 };

 getLanguage = async (guildIdOrLocale: bigint | undefined | null | string) => {
  if (!guildIdOrLocale) return this.getLanguageForLocale('en-GB');

  if (typeof guildIdOrLocale === 'string' && guildIdOrLocale.includes('-')) {
   return this.getLanguageForLocale(guildIdOrLocale as keyof typeof Language.languages);
  }

  const base = new GuildSetting(this.db, String(guildIdOrLocale));
  const setting = await base.get();

  return this.getLanguageForLocale(
   (setting?.language || 'en-GB') as keyof typeof Language.languages,
  );
 };
}
