import type { Prisma } from '@ayako/database';

import type { DataBaseTables, TableName } from '../types/prisma.js';

import type Cache from './Cache.js';
import logger from './Logger.js';

export type MaybeArray<T = unknown> = T | T[];

export interface CacheOperationData {
 args: { where?: Record<string, unknown> };
 operation: string;
 query: (args: unknown) => Promise<unknown>;
}

export class DatabaseCache {
 readonly cache: typeof Cache;

 constructor(cache: typeof Cache) {
  this.cache = cache;
  logger.debug('[DatabaseCache] DatabaseCache initialized');
 }

 handleOperation = <T extends TableName>(
  name: T,
  index: keyof DataBaseTables[T] & string,
  data: CacheOperationData,
 ) => {
  if (!('where' in data.args) || !data.args.where) {
   logger.silly('[DatabaseCache] No where clause, bypassing cache for', name, data.operation);
   return data.query(data.args);
  }
  if (!data.args.where) return data.query(data.args);

  const indexValues = this.getKey<typeof name>(data.args.where, index);

  if (!indexValues?.length) {
   logger.silly('[DatabaseCache] No index values found, bypassing cache for', name, data.operation);
   return data.query(data.args);
  }
  const keys = indexValues.map((value) => `settings:${name}:${value}`);

  logger.silly('[DatabaseCache] Handling', data.operation, 'for', name, 'with keys:', keys);

  switch (data.operation) {
   case 'findMany':
   case 'findFirst':
   case 'findUnique':
    return this.handleFind(data, keys, name, index);
   case 'update':
   case 'updateMany':
   case 'upsert':
   case 'create':
   case 'delete':
   case 'deleteMany':
   case 'createMany':
   case 'createManyAndReturn':
    logger.debug('[DatabaseCache] Invalidating cache keys for', name, ':', keys);
    keys.forEach((key) => (key.length ? this.cache.cacheDb.del(key) : 0));
    return data.query(data.args);
   default:
    return data.query(data.args);
  }
 };

 private handleFind = async <T extends TableName>(
  data: CacheOperationData,
  keys: string[],
  tableName: T,
  keyName: keyof DataBaseTables[T],
 ) => {
  const cached = await Promise.all(keys.map((key) => this.cache.cacheDb.get(key)));

  if (cached.some((c) => c === null) || !cached.length) {
   logger.debug('[DatabaseCache] Cache MISS for', tableName, '- fetching from database');
   return this.cacheNewEntry(
    (await data.query(data.args as Parameters<typeof data.query>[0])) as MaybeArray<
     DataBaseTables[T]
    >,
    tableName,
    keyName,
   );
  }

  if (!this.isValid(cached as string[])) {
   logger.warn('[DatabaseCache] Invalid cached data for', tableName, '- fetching from database');
   return data.query(data.args as Parameters<typeof data.query>[0]);
  }

  logger.debug('[DatabaseCache] Cache HIT for', tableName);
  const validCached = (cached as string[]).map((c) => JSON.parse(c) as DataBaseTables[T]);

  return ['findUnique', 'findFirst'].includes(data.operation) ? validCached[0] : validCached;
 };

 private isValid = (cached: string[]) => {
  try {
   cached.forEach((c) => JSON.parse(c));
   return true;
  } catch {
   return false;
  }
 };

 private cacheNewEntry = <T extends TableName>(
  res: MaybeArray<DataBaseTables[T]>,
  tableName: T,
  keyName: keyof DataBaseTables[T],
 ) => {
  if ((Array.isArray(res) && !res.length) || !res) {
   logger.silly('[DatabaseCache] No result to cache for', tableName);
   return res;
  }

  if (Array.isArray(res)) {
   const filteredRes = res.filter((r) => !!r[keyName]);
   logger.silly('[DatabaseCache] Caching', filteredRes.length, 'entries for', tableName);
   filteredRes.forEach((r) =>
    this.cache.cacheDb.set(`settings:${tableName}:${r[keyName]}`, JSON.stringify(r)),
   );
  } else if (res[keyName]) {
   logger.silly('[DatabaseCache] Caching entry for', tableName, ':', res[keyName]);
   this.cache.cacheDb.set(`settings:${tableName}:${res[keyName]}`, JSON.stringify(res));
  }

  return res;
 };

 private getKey = <T extends TableName>(
  where: Record<string, unknown> | Prisma.StringFilter | undefined,
  keyName: keyof DataBaseTables[T] & string,
 ): string[] | null => {
  if (!where) return null;
  if (!(keyName in where)) return null;

  const keyVal = (where as Record<string, unknown>)[keyName as string];

  if (!keyVal) return null;
  if (typeof keyVal === 'string') return [keyVal];
  if (typeof keyVal !== 'object') return null;
  if ('in' in keyVal && keyVal.in) {
   if (!Array.isArray(keyVal.in)) return null;
   return keyVal.in.map(String);
  }

  return null;
 };
}
