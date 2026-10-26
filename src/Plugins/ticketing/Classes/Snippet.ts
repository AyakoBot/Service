import type { Snippets } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import type { FindManyArgs } from '../../../Types/prisma.js';
import { triggerCandidates } from '../Util/tagCommands.js';

import { SnippetErrors } from './Enums.js';

export interface SnippetData {
 name: string;
 trigger?: string | null;
 userText?: string | null;
 staffText?: string | null;
 kinds: string[];
}

const assertFilled = (
 data: Pick<SnippetData, 'userText' | 'staffText'>,
 commands?: string | null,
) => {
 if (!data.userText?.trim() && !data.staffText?.trim() && !commands?.trim()) {
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

 static async matchTrigger(
  client: Client,
  guild: string,
  content: string,
 ): Promise<{ snippet: Snippets; input: string } | null> {
  const text = content.trim();
  const rows = await client.db.client.snippets.findMany({
   where: { guild, trigger: { in: triggerCandidates(text) } },
  });

  const [snippet] = rows
   .filter((row) => row.trigger === text || row.commands?.trim())
   .sort((a, b) => (b.trigger?.length ?? 0) - (a.trigger?.length ?? 0));
  if (!snippet?.trigger) return null;

  return { snippet, input: text.slice(snippet.trigger.length).trim() };
 }

 static async update(client: Client, id: string, data: SnippetData): Promise<Snippets> {
  assertFilled(data, (await Snippet.byId(client, id))?.commands);

  return client.db.client.snippets.update({ where: { id }, data: writeData(data) });
 }

 static async setCommands(client: Client, id: string, commands: string): Promise<Snippets> {
  const current = await Snippet.byId(client, id);
  if (!current) throw new Error(SnippetErrors.notFound);
  assertFilled(current, commands);

  return client.db.client.snippets.update({
   where: { id },
   data: { commands: commands.trim() || null },
  });
 }

 static async create(client: Client, guild: string, data: SnippetData): Promise<Snippets> {
  assertFilled(data);

  return client.db.client.snippets.create({
   data: { id: String(Date.now()), guild, ...writeData(data) },
  });
 }
}
