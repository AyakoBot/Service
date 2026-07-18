import type { TicketPanel as TicketPanelRow } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import type { FindManyArgs, UpdateData } from '../../../Types/prisma.js';

export default class TicketPanel {
 guild: string;
 private client: Client;
 private where: { id: string };

 constructor(client: Client, guild: string, id: string) {
  this.client = client;
  this.where = { id };
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

 update(data: UpdateData<'ticketPanel'>): Promise<TicketPanelRow> {
  return this.client.db.client.ticketPanel.update({ where: this.where, data });
 }

 setMessage(message: string | null): Promise<TicketPanelRow> {
  return this.update({ message });
 }

 remove(): Promise<TicketPanelRow> {
  return this.client.db.client.ticketPanel.delete({ where: this.where });
 }
}
