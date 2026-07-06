import type { UpdateData } from '../../../Types/prisma.js';
import type { FieldTransform } from '../../settings/SettingsSchema.js';
import { SavedSource } from '../Classes/Enums.js';
import en from '../Language/en-GB.json' with { type: 'json' };

export const savedRefTransform =
 (source: SavedSource, clear: UpdateData<'welcomeSetting'>): FieldTransform =>
 async (value, ctx) => {
  const name = String(value).trim();
  const where = { guild: ctx.guildId, name };
  const saved =
   source === SavedSource.Embed
    ? await ctx.client.db.client.customEmbed.findFirst({ where })
    : await ctx.client.db.client.customComponents.findFirst({ where });
  if (!saved) {
   return {
    error: source === SavedSource.Embed ? en.errors.embedNotFound : en.errors.componentsNotFound,
   };
  }

  await ctx.client.db.client.welcomeSetting.update({ where: { id: ctx.rowId }, data: clear });
  return { value: name };
 };
