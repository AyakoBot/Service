import { logger } from '@ayako/utility';

import type {
 CreateData,
 DataBaseTables,
 FindManyArgs,
 TableName,
 UpdateData,
 WhereUnique,
} from '../../Types/prisma.js';
import type Client from '../Client.js';
import type Database from '../Database.js';

interface ModelDelegate<T extends TableName> {
 findUnique(args: { where: WhereUnique<T> }): Promise<DataBaseTables[T] | null>;
 delete(args: { where: WhereUnique<T> }): Promise<DataBaseTables[T]>;
 update(args: { where: WhereUnique<T>; data: UpdateData<T> }): Promise<DataBaseTables[T]>;
 upsert(args: {
  create: CreateData<T>;
  update: UpdateData<T>;
  where: WhereUnique<T>;
 }): Promise<DataBaseTables[T]>;
 findMany(args: FindManyArgs<T>): Promise<DataBaseTables[T][]>;
}

export default abstract class DBEntry<const T extends TableName> {
 protected tableName: T;
 protected identity: WhereUnique<T>;
 protected db: Database;
 protected client: Client;

 constructor(client: Client, tableName: T, identity: WhereUnique<T>) {
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
  return this.delegate().findUnique({ where: this.identity });
 }

 delete(): Promise<DataBaseTables[T]> {
  logger.debug('[DBEntry] Deleting', this.tableName, 'entry');
  return this.delegate()
   .delete({ where: this.identity })
   .then((r) => r);
 }

 update(data: UpdateData<T>): Promise<DataBaseTables[T]> {
  logger.debug('[DBEntry] Updating', this.tableName, 'entry');
  return this.delegate()
   .update({ where: this.identity, data })
   .then((r) => r);
 }

 upsert(
  createData: CreateData<T>,
  updateData: UpdateData<T>,
 ): Promise<DataBaseTables[T]> {
  logger.debug('[DBEntry] Upserting', this.tableName, 'entry');
  return this.delegate()
   .upsert({ where: this.identity, create: createData, update: updateData })
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
 where: WhereUnique<T>,
) => {
 logger.debug('[DBEntry] Deleting many', tableName, 'entries');
 const delegate = (client.db.client as unknown as Record<string, unknown>)[
  tableName
 ] as ModelDelegate<T>;
 return delegate.delete({ where });
};
