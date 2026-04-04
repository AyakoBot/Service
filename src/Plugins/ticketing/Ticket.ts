import type { Prisma, TicketSetting } from '@ayako/database';
import DBEntry, { deleteMany, findMany } from '../../Classes/abstracts/DBEntry.js';
import type Client from '../../Classes/Client.js';
import type { DataBaseTables, FindManyArgs, WhereUnique } from '../../Types/prisma.js';

export default class Ticket extends DBEntry<'ticket'> {
 constructor(client: Client, id: string) {
  super(client, 'ticket', { id });
 }

 static findMany(client: Client, args: FindManyArgs<'ticket'>) {
  return findMany(client, 'ticket', args);
 }

 static delete(client: Client, args: WhereUnique<'ticket'>) {
  return deleteMany(client, 'ticket', args);
 }

 getWithInclude(
  include: Prisma.TicketInclude,
 ): Promise<(DataBaseTables['ticket'] & { settings: TicketSetting }) | null> {
  return this.client.db.client.ticket.findUnique({
   where: this.identity,
   include,
  });
 }
}
