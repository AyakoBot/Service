import type { FieldTransform } from '../Plugins/settings/SettingsSchema.js';

export default (notFound: string): FieldTransform =>
 async (value, ctx) => {
  const name = String(value).trim();
  if (!name) return { value: null };

  const saved = await ctx.client.db.client.customEmbed.findFirst({
   where: { guild: ctx.guildId, name },
  });

  return saved ? { value: name } : { error: notFound };
 };
