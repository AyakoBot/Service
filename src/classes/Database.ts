import { Prisma, PrismaClient } from '@ayako/database';

import type Cache from './Cache.js';
import { DatabaseCache } from './DatabaseCache.js';
import type Logger from './Logger.js';
import logger from './Logger.js';
import type Metrics from './Metrics.js';

export default class Database {
 readonly client: ReturnType<typeof PrismaClient.prototype.$extends>;
 readonly cache: DatabaseCache;

 constructor(loggerInstance: typeof Logger, metrics: typeof Metrics, cache: typeof Cache) {
  logger.debug('[Database] Initializing Database...');

  this.cache = new DatabaseCache(cache);

  logger.silly('[Database] Creating PrismaClient with extensions...');
  this.client = new PrismaClient()
   .$extends(this.getLoggingExtension(loggerInstance))
   .$extends(this.getMetricsExtension(metrics))
   .$extends(this.getCacheExtension());

  logger.log('[Database] Database initialization complete');
 }

 private getLoggingExtension = (loggerInstance: typeof Logger) =>
  Prisma.defineExtension({
   name: 'Logging Middleware',
   query: {
    $allOperations: async ({ model, operation, args, query }) => {
     loggerInstance.silly('[Prisma] Executing', operation, 'on', model);
     try {
      const result = await query(args);
      return result;
     } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
       loggerInstance.error('[Prisma] Error on', model, operation, ':', (error as Error).message);
       loggerInstance.silly('[Prisma] Stack:', (error as Error).stack);
       return null;
      }
      throw error;
     }
    },
   },
  });

 private getMetricsExtension = (metrics: typeof Metrics) =>
  Prisma.defineExtension({
   name: 'Metrics Middleware',
   query: {
    $allOperations: async ({ model, operation, args, query }) => {
     metrics.dbQuery(model ?? '-', operation);

     const start = Date.now();
     const result = await query(args);
     metrics.dbLatency(model ?? '-', operation, Date.now() - start);

     return result;
    },
   },
  });

 private getCacheExtension = () =>
  Prisma.defineExtension({
   name: 'Cache Middleware',
   query: {
    guildsettings: {
     $allOperations: async (data) =>
      this.cache.handleOperation('guildsettings', 'guildid', data as never),
    },
    logchannels: {
     $allOperations: async (data) =>
      this.cache.handleOperation('logchannels', 'guildid', data as never),
    },
    customclients: {
     $allOperations: async (data) =>
      this.cache.handleOperation('customclients', 'guildid', data as never),
    },
    welcome: {
     $allOperations: async (data) =>
      this.cache.handleOperation('welcome', 'guildid', data as never),
    },
   },
  });
}
