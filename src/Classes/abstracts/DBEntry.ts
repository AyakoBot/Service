import { logger } from '@ayako/utility';

import type {
 CreateData,
 DataBaseTables,
 FindManyArgs,
 FindUniqueArgs,
 TableName,
 UpdateData,
} from '../../Types/prisma.js';
import type Client from '../Client.js';
import type Database from '../Database.js';

interface ModelDelegate<T extends TableName> {
 findUnique(args: FindUniqueArgs<T>): Promise<DataBaseTables[T] | null>;
 delete(args: FindUniqueArgs<T>): Promise<DataBaseTables[T]>;
 update(args: FindUniqueArgs<T> & { data: UpdateData<T> }): Promise<DataBaseTables[T]>;
 upsert(
  args: FindUniqueArgs<T> & {
   create: CreateData<T>;
   update: UpdateData<T>;
  },
 ): Promise<DataBaseTables[T]>;
 findMany(args: FindManyArgs<T>): Promise<DataBaseTables[T][]>;
}

export default abstract class DBEntry<const T extends TableName> {
 protected tableName: T;
 protected identity: FindUniqueArgs<T>;
 protected db: Database;
 protected client: Client;

 constructor(client: Client, tableName: T, identity: FindUniqueArgs<T>) {
  this.db = client.db;
  this.client = client;
  this.tableName = tableName;
  this.identity = identity;
  logger.silly('[DBEntry] Created entry for table:', tableName);
 }

 private delegate(): ModelDelegate<T> {
  return (this.db.client as unknown as Record<string, unknown>)[this.tableName] as ModelDelegate<T>;
 }

 get(): Promise<DataBaseTables[T] | null> {
  logger.silly('[DBEntry] Getting', this.tableName, 'entry');
  return this.delegate().findUnique(this.identity);
 }

 delete(): Promise<DataBaseTables[T]> {
  logger.debug('[DBEntry] Deleting', this.tableName, 'entry');
  return this.delegate()
   .delete(this.identity)
   .then((r) => r);
 }

 update(data: UpdateData<T> & FindUniqueArgs<T>): Promise<DataBaseTables[T]> {
  logger.debug('[DBEntry] Updating', this.tableName, 'entry');
  return this.delegate()
   .update({ ...this.identity, data })
   .then((r) => r);
 }

 upsert(createData: CreateData<T>, updateData: UpdateData<T>): Promise<DataBaseTables[T]> {
  logger.debug('[DBEntry] Upserting', this.tableName, 'entry');
  return this.delegate()
   .upsert({ ...this.identity, create: createData, update: updateData })
   .then((r) => r);
 }
}

export const findMany = <T extends TableName>(
 client: Client,
 tableName: T,
 args: FindManyArgs<T>,
): Promise<DataBaseTables[T][]> => {
 logger.silly('[DBEntry] Finding many', tableName, 'entries');
 const delegate = (client.db.client as unknown as Record<string, unknown>)[
  tableName
 ] as ModelDelegate<T>;
 return delegate.findMany(args).then((r: DataBaseTables[T][]) => r);
};

export const deleteMany = <T extends TableName>(
 client: Client,
 tableName: T,
 args: FindUniqueArgs<T>,
) => {
 logger.debug('[DBEntry] Deleting many', tableName, 'entries');
 const delegate = (client.db.client as unknown as Record<string, unknown>)[
  tableName
 ] as ModelDelegate<T>;
 return delegate.delete(args);
};

export const findUnique = <T extends TableName>(
 client: Client,
 tableName: T,
 args: FindUniqueArgs<T>,
): Promise<DataBaseTables[T] | null> => {
 logger.silly('[DBEntry] Finding unique', tableName, 'entry');
 const delegate = (client.db.client as unknown as Record<string, unknown>)[
  tableName
 ] as ModelDelegate<T>;
 return delegate.findUnique(args).then((r: DataBaseTables[T] | null) => r);
};
