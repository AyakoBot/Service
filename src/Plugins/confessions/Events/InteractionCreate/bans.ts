import type { ConfessionSetting } from '@ayako/database';
import {
 MessageFlags,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import type ConfessionsPlugin from '../../Plugin.js';
import { banListPage, bansPerPage, type BanPage } from '../../Util/banList.js';

type ListInteraction = APIChatInputApplicationCommandInteraction | APIMessageComponentInteraction;

type Translator = Awaited<ReturnType<ConfessionsPlugin['t']>>;

interface ListAccess {
 settings: ConfessionSetting;
 t: Translator;
}

const meta = { origin: 'Confessions', reason: 'Confession ban list' };

const pageOf = async function (
 this: ConfessionsPlugin,
 guildId: string,
 page: number,
): Promise<BanPage> {
 const where = { guild: guildId, OR: [{ until: null }, { until: { gt: new Date() } }] };
 const total = await this.client.db.client.confessionBan.count({ where });
 const pages = Math.max(1, Math.ceil(total / bansPerPage));
 const current = Math.min(Math.max(Number.isFinite(page) ? Math.trunc(page) : 0, 0), pages - 1);
 const bans = await this.client.db.client.confessionBan.findMany({
  where,
  orderBy: { createdAt: 'desc' },
  skip: current * bansPerPage,
  take: bansPerPage,
 });

 return { bans, page: current, pages, total };
};

const accessOf = async function (
 this: ConfessionsPlugin,
 cmd: ListInteraction,
): Promise<ListAccess | string> {
 const t = await this.t(cmd.guild_id ?? '');
 const settings = cmd.guild_id ? await this.confessions.settings(cmd.guild_id) : null;
 if (!settings) return t.errors.notEnabled();
 if (!this.confessions.reviewerAllowed(settings, cmd.member)) return t.errors.notReviewer();

 return { settings, t };
};

const pageBody = async function (
 this: ConfessionsPlugin,
 access: ListAccess,
 page: number,
 flags: MessageFlags,
) {
 const api = await this.getAPI(access.settings.guild);

 return {
  flags,
  components: banListPage(
   access.t,
   await pageOf.call(this, access.settings.guild, page),
   (name: string, ...args: string[]) => this.getRoute(name, ...args),
   this.client.emojis.for(api),
  ),
  allowed_mentions: { parse: [] },
 };
};

const refuse = async function (
 this: ConfessionsPlugin,
 cmd: ListInteraction,
 content: string,
): Promise<void> {
 const api = await this.getAPI(cmd.guild_id ?? '');
 await api.interactions.reply(cmd.id, cmd.token, { content, flags: MessageFlags.Ephemeral }, meta);
};

export const openBans = async function (
 this: ConfessionsPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
): Promise<void> {
 const access = await accessOf.call(this, cmd);
 if (typeof access === 'string') {
  await refuse.call(this, cmd, access);
  return;
 }

 const api = await this.getAPI(access.settings.guild);
 const flags = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
 await api.interactions.reply(cmd.id, cmd.token, await pageBody.call(this, access, 0, flags), meta);
};

export const bansPage = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 page: string,
): Promise<void> {
 const access = await accessOf.call(this, cmd);
 if (typeof access === 'string') {
  await refuse.call(this, cmd, access);
  return;
 }

 const api = await this.getAPI(access.settings.guild);
 const body = await pageBody.call(this, access, Number(page), MessageFlags.IsComponentsV2);
 await api.interactions.updateMessage(cmd.id, cmd.token, body, meta);
};

export const bansUnban = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 identity: string,
 page: string,
): Promise<void> {
 const access = await accessOf.call(this, cmd);
 if (typeof access === 'string' || !cmd.member) {
  await refuse.call(this, cmd, typeof access === 'string' ? access : '');
  return;
 }

 await this.moderation.unban(access.settings, identity, cmd.member.user.id);

 const api = await this.getAPI(access.settings.guild);
 const body = await pageBody.call(this, access, Number(page), MessageFlags.IsComponentsV2);
 await api.interactions.updateMessage(cmd.id, cmd.token, body, meta);
};
