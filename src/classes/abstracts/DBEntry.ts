import type { Prisma } from '@ayako/database';

import type { DataBaseTables } from '../../types/prisma.js';
import type Database from '../Database.js';
import Logger from '../Logger.js';

type PrismaModelName = keyof Prisma.TypeMap['model'];
type TableName = keyof DataBaseTables;

type Capitalize<S extends string> = S extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}` : S;
type ToPrismaModel<T extends TableName> =
 Capitalize<T> extends PrismaModelName ? Capitalize<T> : T extends PrismaModelName ? T : never;

type Operations<T extends PrismaModelName> = Prisma.TypeMap['model'][T]['operations'];
type Args<T extends PrismaModelName, K extends keyof Operations<T>> = Operations<T>[K];

type WhereUnique<T extends TableName> = Args<ToPrismaModel<T>, 'findUnique'>['args']['where'];
type UpdateData<T extends TableName> = Args<ToPrismaModel<T>, 'update'>['args']['data'];

interface ModelDelegate<T extends TableName> {
 findUnique(args: { where: WhereUnique<T> }): Promise<DataBaseTables[T] | null>;
 delete(args: { where: WhereUnique<T> }): Promise<DataBaseTables[T]>;
 update(args: { where: WhereUnique<T>; data: UpdateData<T> }): Promise<DataBaseTables[T]>;
}

export default abstract class DBEntry<const T extends TableName> {
 protected tableName: T;
 protected identity: WhereUnique<T>;
 protected db: Database;

 constructor(db: Database, tableName: T, identity: WhereUnique<T>) {
  this.db = db;
  this.tableName = tableName;
  this.identity = identity;
  Logger.silly('[DBEntry] Created entry for table:', tableName);
 }

 private delegate(): ModelDelegate<T> {
  return this.db.client[this.tableName] as unknown as ModelDelegate<T>;
 }

 get(): Promise<DataBaseTables[T] | null> {
  Logger.silly('[DBEntry] Getting', this.tableName, 'entry');
  return this.delegate().findUnique({ where: this.identity });
 }

 delete(): Promise<DataBaseTables[T]> {
  Logger.debug('[DBEntry] Deleting', this.tableName, 'entry');
  return this.delegate()
   .delete({ where: this.identity })
   .then((r) => r);
 }

 update(data: UpdateData<T>): Promise<DataBaseTables[T]> {
  Logger.debug('[DBEntry] Updating', this.tableName, 'entry');
  return this.delegate()
   .update({ where: this.identity, data })
   .then((r) => r);
 }
}
