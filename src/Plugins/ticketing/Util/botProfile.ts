import { RequestHandlerError } from '@ayako/api';
import type { TicketSetting } from '@ayako/database';

import { fetchDiscordCdn, isDiscordCdnUrl, toDataUri } from '../../../Util/discordCdn.js';
import type {
 FieldTransform,
 RowGuardContext,
 SettingsFieldVirtual,
} from '../../settings/SettingsSchema.js';
import type TicketPlugin from '../Plugin.js';

export enum BotProfilePart {
 Nick = 'nick',
 Avatar = 'avatar',
 Banner = 'banner',
}

const origin = 'ticketBotProfile';

const profileApi = (row: TicketSetting, ctx: RowGuardContext) =>
 (ctx.plugin as TicketPlugin).getAPI(row.guild, row.botToken);

const readMember = async (row: TicketSetting, ctx: RowGuardContext) => {
 const api = await profileApi(row, ctx);
 const cached = await ctx.client.cache.members.get(row.guild, api.botId);
 if (cached) return cached;

 const fetched = await api.guilds.getMember(row.guild, api.botId, {
  origin,
  reason: 'Reading the bot server profile',
  silent: true,
 });
 return fetched instanceof RequestHandlerError ? null : fetched;
};

export const botProfileVirtual = (part: BotProfilePart): SettingsFieldVirtual<TicketSetting> => ({
 read: async (row, ctx) => {
  const member = await readMember(row, ctx);
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

  const plugin = ctx.plugin as TicketPlugin;
  const api = await profileApi(row, ctx);
  const t = await plugin.t(row.guild);

  const res = await api.users.editCurrentGuildMember(
   row.guild,
   { [part]: (value as string | null) ?? null },
   { origin, reason: 'Updating the bot server profile' },
  );

  if (res instanceof RequestHandlerError) {
   plugin.nonFatalError(res, origin);
   return { ok: false, reason: t.settings.profileWriteFailed() };
  }

  await ctx.client.cache.members.set(res, row.guild);

  return { ok: true };
 },
});

export const botProfileImageTransform: FieldTransform = async (value, ctx) => {
 const url = String(value).trim();
 const t = await (ctx.plugin as TicketPlugin).t(ctx.guildId);

 if (!isDiscordCdnUrl(url)) return { error: t.base.errors.notDiscordCdn() };

 const file = await fetchDiscordCdn(url);
 if (!file) return { error: t.base.errors.notDiscordCdn() };

 return { value: toDataUri(file.contentType, file.data) };
};
