import type { CustomComponents as CustomComponentsRow, Prisma } from '@ayako/database';

import type Client from '../../Classes/Client.js';
import type { FindManyArgs } from '../../Types/prisma.js';

import type { WipTree } from './Util/componentTree.js';

export default class CustomComponents {
 guild: string;
 private client: Client;
 private where: { id: string };

 constructor(client: Client, guild: string, id: string) {
  this.client = client;
  this.where = { id };
  this.guild = guild;
 }

 static all(client: Client, guild: string): Promise<CustomComponentsRow[]> {
  return client.db.findMany('customComponents', {
   where: { guild },
  } as FindManyArgs<'customComponents'>);
 }

 static byId(client: Client, id: string): Promise<CustomComponentsRow | null> {
  return client.db.client.customComponents.findUnique({ where: { id } });
 }

 static byName(
  client: Client,
  guild: string,
  name: string,
 ): Promise<CustomComponentsRow | null> {
  return client.db.client.customComponents.findFirst({ where: { guild, name } });
 }

 static async save(
  client: Client,
  guild: string,
  name: string,
  components: WipTree,
 ): Promise<CustomComponentsRow> {
  const data = components as unknown as Prisma.InputJsonValue;
  const existing = await CustomComponents.byName(client, guild, name);
  if (existing) {
   return client.db.client.customComponents.update({
    where: { id: existing.id },
    data: { components: data },
   });
  }
  return client.db.client.customComponents.create({
   data: { id: String(Date.now()), guild, name, components: data },
  });
 }

 remove(): Promise<CustomComponentsRow> {
  return this.client.db.client.customComponents.delete({ where: this.where });
 }
}
