import type { Snippets } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import type { FindManyArgs } from '../../../Types/prisma.js';

import { SnippetErrors } from './Enums.js';

export default class Snippet {
 static all(client: Client, guild: string) {
  return client.db.findMany('snippets', {
   where: { guild },
   orderBy: { name: 'asc' },
  } as FindManyArgs<'snippets'>);
 }

 static async byName(client: Client, guild: string, name: string) {
  return client.db.client.snippets.findUnique({ where: { guild_name: { guild, name } } });
 }

 static async byId(client: Client, id: string): Promise<Snippets | null> {
  return client.db.client.snippets.findUnique({ where: { id } });
 }

 static async update(
  client: Client,
  id: string,
  data: { name: string; userText?: string | null; staffText?: string | null; kinds: string[] },
 ): Promise<Snippets> {
  if (!data.userText?.trim() && !data.staffText?.trim()) {
   throw new Error(SnippetErrors.emptySnippet);
  }

  return client.db.client.snippets.update({
   where: { id },
   data: {
    name: data.name,
    userText: data.userText?.trim() || null,
    staffText: data.staffText?.trim() || null,
    kinds: data.kinds,
   },
  });
 }

 static async create(
  client: Client,
  guild: string,
  data: { name: string; userText?: string | null; staffText?: string | null; kinds: string[] },
 ): Promise<Snippets> {
  if (!data.userText?.trim() && !data.staffText?.trim()) {
   throw new Error(SnippetErrors.emptySnippet);
  }

  return client.db.client.snippets.upsert({
   where: { guild_name: { guild, name: data.name } },
   create: {
    id: String(Date.now()),
    guild,
    name: data.name,
    userText: data.userText?.trim() || null,
    staffText: data.staffText?.trim() || null,
    kinds: data.kinds,
   },
   update: {
    userText: data.userText?.trim() || null,
    staffText: data.staffText?.trim() || null,
    kinds: data.kinds,
   },
  });
 }
}
