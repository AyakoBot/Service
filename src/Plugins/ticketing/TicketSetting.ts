import type { Ticket, Prisma } from '@ayako/database';
import DBEntry from '../../Classes/abstracts/DBEntry.js';
import type Client from '../../Classes/Client.js';
import type { DataBaseTables } from '../../Types/prisma.js';

export default class TicketSetting extends DBEntry<'ticketSetting'> {
 constructor(client: Client, id: string) {
  super(client, 'ticketSetting', { id });
 }

 getWithInclude(
  include: Prisma.TicketSettingInclude,
 ): Promise<(DataBaseTables['ticketSetting'] & { Ticket: Ticket[] }) | null> {
  return this.client.db.client.ticketSetting.findUnique({
   where: this.identity,
   include,
  });
 }
}
