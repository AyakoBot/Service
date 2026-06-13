import type { CustomEmbed as CustomEmbedRow, Prisma } from '@ayako/database';
import type { APIEmbed } from 'discord-api-types/v10';

import DBEntry, { findMany } from '../../Classes/abstracts/DBEntry.js';
import type Client from '../../Classes/Client.js';
import type { FindManyArgs } from '../../Types/prisma.js';

export default class CustomEmbed extends DBEntry<'customEmbed'> {
 guild: string;

 constructor(client: Client, guild: string, id: string) {
  super(client, 'customEmbed', { where: { id } });
  this.guild = guild;
 }

 static all(client: Client, guild: string): Promise<CustomEmbedRow[]> {
  return findMany(client, 'customEmbed', { where: { guild } } as FindManyArgs<'customEmbed'>);
 }

 static byId(client: Client, id: string): Promise<CustomEmbedRow | null> {
  return client.db.client.customEmbed.findUnique({ where: { id } });
 }

 static async byName(client: Client, guild: string, name: string): Promise<CustomEmbedRow | null> {
  return client.db.client.customEmbed.findFirst({ where: { guild, name } });
 }

 static async save(
  client: Client,
  guild: string,
  name: string,
  embed: APIEmbed,
 ): Promise<CustomEmbedRow> {
  const data = embed as unknown as Prisma.InputJsonValue;
  const existing = await CustomEmbed.byName(client, guild, name);
  if (existing) {
   return client.db.client.customEmbed.update({
    where: { id: existing.id },
    data: { embed: data },
   });
  }
  return client.db.client.customEmbed.create({
   data: { id: String(Date.now()), guild, name, embed: data },
  });
 }

 setEmbed(embed: APIEmbed): Promise<CustomEmbedRow> {
  return this.update({ embed: embed as unknown as Prisma.InputJsonValue });
 }

 remove(): Promise<CustomEmbedRow> {
  return this.delete();
 }
}
