import { API, GatewayDispatchEvents } from '@discordjs/core';
import { REST } from '@discordjs/rest';

import Cache from './Cache.js';
import Database from './Database.js';
import Logger from './Logger.js';
import Metrics from './Metrics.js';

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

 constructor() {

  Logger.log('[Client] Initializing Client...');
  Logger.debug('[Client] Running in', process.argv.includes('--dev') ? 'development' : 'production', 'mode');
  Logger.silly('[Client] Token configured:', token ? 'yes' : 'no');

  Logger.debug('[Client] Initializing REST API...');
  Logger.silly('[Client] REST API endpoint: http://127.0.0.1:8080/api');

  Logger.debug('[Client] Initializing Database...');
  this.db = new Database(this.logger, this.metrics, this.cache);

  Logger.debug('[Client] Registering gateway event handlers...');
  const events = Object.keys(GatewayDispatchEvents);
  Logger.silly('[Client] Registering', events.length, 'gateway events');
  events.forEach((e) => {
   this.cache.on(e, (...args: unknown[]) => this.logger.silly('[Event]', e, args));
  });

  Logger.log('[Client] Client initialization complete');
 }
}
