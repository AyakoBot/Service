import type { Snippets } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import type { FindManyArgs } from '../../../Types/prisma.js';

import { SnippetErrors } from './Enums.js';

export interface SnippetData {
 name: string;
 trigger?: string | null;
 userText?: string | null;
 staffText?: string | null;
 kinds: string[];
}

const assertFilled = (data: SnippetData) => {
 if (!data.userText?.trim() && !data.staffText?.trim()) {
  throw new Error(SnippetErrors.emptySnippet);
 }
};

const writeData = (data: SnippetData) => ({
 name: data.name,
 trigger: data.trigger?.trim() || null,
 userText: data.userText?.trim() || null,
 staffText: data.staffText?.trim() || null,
 kinds: data.kinds,
});

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

 static async byTrigger(client: Client, guild: string, trigger: string): Promise<Snippets | null> {
  return client.db.client.snippets.findUnique({ where: { guild_trigger: { guild, trigger } } });
 }

 static async byId(client: Client, id: string): Promise<Snippets | null> {
  return client.db.client.snippets.findUnique({ where: { id } });
 }

 static async update(client: Client, id: string, data: SnippetData): Promise<Snippets> {
  assertFilled(data);

  return client.db.client.snippets.update({ where: { id }, data: writeData(data) });
 }

 static async create(client: Client, guild: string, data: SnippetData): Promise<Snippets> {
  assertFilled(data);

  return client.db.client.snippets.create({
   data: { id: String(Date.now()), guild, ...writeData(data) },
  });
 }
}
