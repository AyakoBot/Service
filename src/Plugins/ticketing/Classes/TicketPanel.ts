import type { TicketPanel as TicketPanelRow } from '@ayako/database';

import DBEntry from '../../../Classes/abstracts/DBEntry.js';
import type Client from '../../../Classes/Client.js';
import type { FindManyArgs } from '../../../Types/prisma.js';

export default class TicketPanel extends DBEntry<'ticketPanel'> {
 guild: string;

 constructor(client: Client, guild: string, id: string) {
  super(client, 'ticketPanel', { where: { id } });
  this.guild = guild;
 }

 static all(client: Client, guild: string): Promise<TicketPanelRow[]> {
  return client.db.findMany('ticketPanel', { where: { guild } } as FindManyArgs<'ticketPanel'>);
 }

 static byId(client: Client, id: string): Promise<TicketPanelRow | null> {
  return client.db.client.ticketPanel.findUnique({ where: { id } });
 }

 static create(
  client: Client,
  guild: string,
  data: { channel?: string | null; kinds: string[] },
 ): Promise<TicketPanelRow> {
  return client.db.client.ticketPanel.create({
   data: {
    id: String(Date.now()),
    guild,
    channel: data.channel ?? null,
    kinds: data.kinds,
   },
  });
 }

 setMessage(message: string | null): Promise<TicketPanelRow> {
  return this.update({ message });
 }

 remove(): Promise<TicketPanelRow> {
  return this.delete();
 }
}
