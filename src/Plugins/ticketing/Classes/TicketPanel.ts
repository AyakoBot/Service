import type { TicketPanel as TicketPanelRow } from '@ayako/database';

import DBEntry, { findMany } from '../../../Classes/abstracts/DBEntry.js';
import type Client from '../../../Classes/Client.js';
import type { FindManyArgs } from '../../../Types/prisma.js';

export default class TicketPanel extends DBEntry<'ticketPanel'> {
 guild: string;

 constructor(client: Client, guild: string, id: string) {
  super(client, 'ticketPanel', { where: { id } });
  this.guild = guild;
 }

 static all(client: Client, guild: string): Promise<TicketPanelRow[]> {
  return findMany(client, 'ticketPanel', { where: { guild } } as FindManyArgs<'ticketPanel'>);
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

 kinds(): Promise<string[]> {
  return this.get().then((row) => (row ? row.kinds.map((k) => String(k)) : []));
 }

 async setKinds(kinds: string[]): Promise<TicketPanelRow | null> {
  const row = await this.get();
  if (!row) return null;
  return this.update({ kinds });
 }

 async addKind(settingsId: string): Promise<TicketPanelRow | null> {
  const row = await this.get();
  if (!row) return null;
  const kinds = row.kinds.map((k) => String(k));
  if (kinds.includes(settingsId)) return row;
  return this.update({ kinds: [...kinds, settingsId] });
 }

 async removeKind(settingsId: string): Promise<TicketPanelRow | null> {
  const row = await this.get();
  if (!row) return null;
  const kinds = row.kinds.map((k) => String(k)).filter((k) => k !== settingsId);
  return this.update({ kinds });
 }

 setChannel(channel: string | null): Promise<TicketPanelRow> {
  return this.update({ channel });
 }

 setMessage(message: string | null): Promise<TicketPanelRow> {
  return this.update({ message });
 }

 remove(): Promise<TicketPanelRow> {
  return this.delete();
 }
}
