import type { Prisma, TicketSetting } from '@ayako/database';

import DBEntry, { deleteMany, findMany, findUnique } from '../../Classes/abstracts/DBEntry.js';
import type Client from '../../Classes/Client.js';
import type { DataBaseTables, FindManyArgs, FindUniqueArgs } from '../../Types/prisma.js';

export default class DBTicket extends DBEntry<'ticket'> {
 constructor(client: Client, id: string) {
  super(client, 'ticket', { where: { id } });
 }

 static findMany(client: Client, args: FindManyArgs<'ticket'>) {
  return findMany(client, 'ticket', args);
 }

 static findUnique(client: Client, args: FindUniqueArgs<'ticket'>) {
  return findUnique(client, 'ticket', args);
 }

 static findUniqueWithInclude(
  client: Client,
  args: FindUniqueArgs<'ticket'> & { include: Prisma.TicketInclude },
 ) {
  return findUnique(client, 'ticket', args) as Promise<
   (DataBaseTables['ticket'] & { settings: TicketSetting }) | null
  >;
 }

 static delete(client: Client, args: FindUniqueArgs<'ticket'>) {
  return deleteMany(client, 'ticket', args);
 }

 getWithInclude(
  include: Prisma.TicketInclude,
 ): Promise<(DataBaseTables['ticket'] & { settings: TicketSetting }) | null> {
  return this.client.db.client.ticket.findUnique({
   ...this.identity,
   include,
  });
 }
}
