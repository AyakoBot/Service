import { Prisma, PrismaClient } from '@ayako/database';
import type { Cache, logger as Logger } from '@ayako/utility';
import { PrismaPg } from '@prisma/adapter-pg';

import type { DataBaseTables, FindManyArgs, TableName } from '../Types/prisma.js';

import type { ModelDelegate } from './abstracts/DBEntry.js';
import type { CacheOperationData } from './DatabaseCache.js';
import { DatabaseCache } from './DatabaseCache.js';
import type Metrics from './Metrics.js';

export default class Database {
 readonly client: PrismaClient;
 readonly cache: DatabaseCache;

 constructor(logger: typeof Logger, metrics: typeof Metrics, cache: Cache) {
  logger.debug('[Database] Initializing Database...');

  this.cache = new DatabaseCache(cache);

  logger.silly('[Database] Creating PrismaClient with extensions...');
  this.client = new PrismaClient({
   adapter: new PrismaPg({
    connectionString: `${
     process.argv.includes('--local')
      ? process.env.MAIN_DATABASE_URL?.replace('postgres:5432', 'localhost:5432')
      : process.env.MAIN_DATABASE_URL
    }/Ayako-v3`,
   }),
  })
   .$extends(this.getLoggingExtension(logger))
   .$extends(this.getMetricsExtension(metrics))
   .$extends(this.getCacheExtension()) as unknown as PrismaClient;

  logger.log('[Database] Database initialization complete');
 }

 findMany = <T extends TableName>(
  tableName: T,
  args: FindManyArgs<T>,
 ): Promise<DataBaseTables[T][]> => {
  const delegate = (this.client as unknown as Record<string, unknown>)[
   tableName
  ] as ModelDelegate<T>;
  return delegate.findMany(args);
 };

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
      loggerInstance.error('[Prisma] Error on', model, operation, ':', (error as Error).message);
      loggerInstance.debug('[Prisma] Stack:', (error as Error).stack);
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
    guildSetting: {
     $allOperations: async (data) =>
      this.cache.handleOperation('guildSetting', 'guildId', data as CacheOperationData),
    },
    // logchannels: {
    //  $allOperations: async (data) =>
    //   this.cache.handleOperation('logchannels', 'guildid', data as CacheOperationData),
    // },
    customClient: {
     $allOperations: async (data) =>
      this.cache.handleOperation('customClient', 'guildId', data as CacheOperationData),
    },
    // welcome: {
    //  $allOperations: async (data) =>
    //   this.cache.handleOperation('welcome', 'guildid', data as CacheOperationData),
    // },
   },
  });
}
