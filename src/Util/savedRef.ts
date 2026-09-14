import type { APIEmbed, APIMessageTopLevelComponent } from 'discord-api-types/v10';

import type Client from '../Classes/Client.js';
import type { FieldTransform, SettingsDelegate } from '../Plugins/settings/SettingsSchema.js';
import type { TableName } from '../Types/prisma.js';

export enum SavedSource {
 Embed = 'customEmbed',
 Components = 'customComponents',
}

export interface SavedContent {
 embed?: APIEmbed;
 components?: APIMessageTopLevelComponent[];
}

export const savedRefTransform =
 (
  source: SavedSource,
  table: TableName,
  clear: Record<string, unknown>,
  notFound: string,
 ): FieldTransform =>
 async (value, ctx) => {
  const name = String(value ?? '').trim();
  if (!name) return { value: null };

  const where = { guild: ctx.guildId, name };
  const saved =
   source === SavedSource.Embed
    ? await ctx.client.db.client.customEmbed.findFirst({ where })
    : await ctx.client.db.client.customComponents.findFirst({ where });
  if (!saved) return { error: notFound };

  await (ctx.client.db.client as unknown as Record<string, SettingsDelegate>)[table]?.updateMany({
   where: { id: ctx.rowId },
   data: clear,
  });

  return { value: name };
 };

export const resolveSavedContent = async (
 client: Client,
 guildId: string,
 refs: { embed?: string | null; components?: string | null },
): Promise<SavedContent | null> => {
 if (refs.components) {
  const saved = await client.db.client.customComponents.findFirst({
   where: { guild: guildId, name: refs.components },
  });

  if (saved?.components) {
   return { components: saved.components as unknown as APIMessageTopLevelComponent[] };
  }
 }

 if (refs.embed) {
  const saved = await client.db.client.customEmbed.findFirst({
   where: { guild: guildId, name: refs.embed },
  });

  if (saved?.embed) return { embed: saved.embed as APIEmbed };
 }

 return null;
};
