import { RequestHandlerError } from '@ayako/api';

import type Plugin from '../Classes/abstracts/Plugin.js';
import type {
 FieldTransform,
 RowGuardContext,
 SettingsFieldVirtual,
} from '../Plugins/settings/SettingsSchema.js';

import { fetchDiscordCdn, isDiscordCdnUrl, toDataUri } from './discordCdn.js';

export enum BotProfilePart {
 Nick = 'nick',
 Avatar = 'avatar',
 Banner = 'banner',
 Bio = 'bio',
}

export interface BotProfileRow {
 guild: string;
 botToken: string | null;
}

const origin = 'botProfile';

export const createBotProfileVirtual = <T extends BotProfileRow>(
 part: BotProfilePart,
 writeFailed: (plugin: Plugin) => Promise<string> | string,
): SettingsFieldVirtual<T> => ({
 read: async (row, ctx) => {
  if (part === BotProfilePart.Bio) return null;

  const api = await (ctx.plugin as Plugin).getAPI(row.guild, row.botToken);
  const cached = await ctx.client.cache.members.get(row.guild, api.botId);
  const member =
   cached ??
   (await api.guilds
    .getMember(row.guild, api.botId, {
     origin,
     reason: 'Reading the bot server profile',
     silent: true,
    })
    .then((res) => (res instanceof RequestHandlerError ? null : res)));

  if (!member) return null;

  switch (part) {
   case BotProfilePart.Nick:
    return member.nick ?? null;
   case BotProfilePart.Avatar:
    return member.avatar_url ?? null;
   case BotProfilePart.Banner:
    return member.banner_url ?? null;
  }
 },
 write: async (value, row, ctx) => {
  if (value === undefined) return { ok: true };

  const plugin = ctx.plugin as Plugin;
  const api = await plugin.getAPI(row.guild, row.botToken);

  const raw = typeof value === 'string' ? value.trim() : value;
  const res = await api.users.editCurrentGuildMember(
   row.guild,
   { [part]: raw === '' || raw === undefined ? null : (raw as string | null) },
   { origin, reason: 'Updating the bot server profile' },
  );

  if (res instanceof RequestHandlerError) {
   plugin.nonFatalError(res, origin);
   const detail = res.errorMessage?.replace(/\s+/g, ' ').trim();
   return { ok: false, reason: detail || (await writeFailed(plugin)) };
  }

  await ctx.client.cache.members.set(res, row.guild);
  return { ok: true };
 },
});

export const createBotProfileImageTransform = (
 notCdn: (plugin: Plugin, guildId: string) => Promise<string> | string,
): FieldTransform =>
 async (value, ctx) => {
  const url = String(value).trim();

  if (!isDiscordCdnUrl(url)) {
   return { error: await notCdn(ctx.plugin as Plugin, ctx.guildId) };
  }

  const file = await fetchDiscordCdn(url);
  if (!file) return { error: await notCdn(ctx.plugin as Plugin, ctx.guildId) };

  return { value: toDataUri(file.contentType, file.data) };
 };

export const createPresenceEmojiTransform = (
 notFound: (plugin: Plugin, guildId: string, name: string) => Promise<string> | string,
): FieldTransform =>
 async (value, ctx) => {
  if (typeof value !== 'string') return { value: '' };

  const raw = value.trim();
  if (raw.length === 0) return { value: '' };
  if (/^<(a?):(\w+):(\d+)>$/.test(raw)) return { value: raw };

  const match = /^:?(\w{2,32}):?$/.exec(raw);
  if (!match) return { value: raw };

  const [, name] = match;
  const emojis = await ctx.client.cache.emojis.getAll(ctx.guildId);
  const emoji = emojis.find((e) => e.name === name);

  if (!emoji) return { error: await notFound(ctx.plugin as Plugin, ctx.guildId, name as string) };

  return { value: `<${emoji.animated ? 'a' : ''}:${name}:${emoji.id}>` };
 };

export type { RowGuardContext };
