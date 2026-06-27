import type { FieldTransform } from '../../settings/SettingsSchema.js';
import type TicketPlugin from '../Plugin.js';

const customEmoji = /^<(a?):(\w+):(\d+)>$/;
const shortcode = /^:?(\w{2,32}):?$/;

export const presenceEmojiTransform: FieldTransform = async (value, ctx) => {
 if (typeof value !== 'string') return { value: '' };

 const raw = value.trim();
 if (raw.length === 0) return { value: '' };
 if (customEmoji.test(raw)) return { value: raw };

 const match = shortcode.exec(raw);
 if (!match) return { value: raw };

 const [, name] = match;
 const emojis = await ctx.client.cache.emojis.getAll(ctx.guildId);
 const emoji = emojis.find((e) => e.name === name);

 if (!emoji) {
  const t = await (ctx.plugin as TicketPlugin).t(ctx.guildId);
  return { error: t.settings.presenceEmojiNotFound({ name }) };
 }

 return { value: `<${emoji.animated ? 'a' : ''}:${name}:${emoji.id}>` };
};
