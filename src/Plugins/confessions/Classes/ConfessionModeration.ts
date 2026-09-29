import { RequestHandlerError, type RequestHandlerErrorType } from '@ayako/api';
import type { Confession as ConfessionRow, ConfessionSetting } from '@ayako/database';
import { MessageFlags } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import type ConfessionsPlugin from '../Plugin.js';
import { ConfessionLogKind, subjectOf } from '../Util/logContainer.js';
import { reportCard } from '../Util/reportCard.js';
import { removalTargets } from '../Util/threads.js';

const origin = 'Confessions';

export interface BanRequest {
 settings: ConfessionSetting;
 confession: ConfessionRow;
 actor: string;
 reason: string | null;
 until: Date | null;
}

export default class ConfessionModeration {
 plugin: ConfessionsPlugin;
 client: Client;

 constructor(plugin: ConfessionsPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 jumpLink = (row: ConfessionRow): string | null =>
  row.channel && row.message
   ? `https://discord.com/channels/${row.guild}/${row.channel}/${row.message}`
   : null;

 parentNumber = async (row: ConfessionRow): Promise<number | null | undefined> => {
  if (!row.parent) return undefined;

  return (await this.plugin.confessions.byId(row.parent))?.number ?? null;
 };

 ban = async (req: BanRequest): Promise<void> => {
  const { settings, confession, actor, reason, until } = req;
  const parentNumber = await this.parentNumber(confession);
  const snapshot = {
   by: actor,
   reason,
   until,
   confession: confession.id,
   number: parentNumber === undefined ? confession.number : parentNumber,
   reply: parentNumber !== undefined,
   content: confession.content,
  };

  await this.client.db.client.confessionBan.upsert({
   where: { guild_identity: { guild: settings.guild, identity: confession.identity } },
   create: { guild: settings.guild, identity: confession.identity, ...snapshot },
   update: { ...snapshot, createdAt: new Date() },
  });

  await this.plugin.confessionLog.record(settings, {
   kind: ConfessionLogKind.Banned,
   number: confession.number,
   parentNumber,
   author: confession.author,
   actor,
   content: confession.content,
   media: confession.media,
   reason,
   until,
   link: this.jumpLink(confession),
  });
 };

 unban = async (settings: ConfessionSetting, identity: string, actor: string): Promise<boolean> => {
  const where = { guild_identity: { guild: settings.guild, identity } };
  const ban = await this.client.db.client.confessionBan.findUnique({ where });
  if (!ban) return false;

  await this.client.db.client.confessionBan.deleteMany({ where: { guild: settings.guild, identity } });
  const confession = ban.confession ? await this.plugin.confessions.byId(ban.confession) : null;

  await this.plugin.confessionLog.record(settings, {
   kind: ConfessionLogKind.Unbanned,
   number: ban.reply ? null : ban.number,
   parentNumber: ban.reply ? ban.number : undefined,
   author: confession?.author ?? null,
   actor,
  });

  return true;
 };

 report = async (
  settings: ConfessionSetting,
  confession: ConfessionRow,
  reporter: string,
  reason: string,
 ): Promise<string | null> => {
  const t = await this.plugin.t(settings.guild);
  if (!settings.reviewChannel) return t.errors.noReviewChannel();

  const api = await this.plugin.getAPI(settings.guild);
  const parentNumber = await this.parentNumber(confession);
  const link = this.jumpLink(confession);
  const card = reportCard(
   t,
   {
    subject: subjectOf(t, { number: confession.number, parentNumber }),
    content: confession.content,
    media: confession.media,
    reporter,
    reason,
    link,
   },
   this.client.emojis.for(api),
  );

  const res = await api.channels.createMessage(
   settings.reviewChannel,
   { flags: MessageFlags.IsComponentsV2, components: [card], allowed_mentions: { parse: [] } },
   { origin, reason: 'Confession reported' },
  );

  if (res instanceof RequestHandlerError) {
   this.plugin.nonFatalError(res, 'confession report');
   return t.errors.reportFailed({
    channel: `<#${settings.reviewChannel}>`,
    error: res.errorMessage ?? t.base.errors.unknownError(),
   });
  }

  await this.plugin.confessionLog.record(settings, {
   kind: ConfessionLogKind.Reported,
   number: confession.number,
   parentNumber,
   author: confession.author,
   actor: reporter,
   content: confession.content,
   media: confession.media,
   reason,
   link,
  });

  return null;
 };

 private failed = async (
  settings: ConfessionSetting,
  error: RequestHandlerError<RequestHandlerErrorType>,
 ): Promise<string> => {
  const t = await this.plugin.t(settings.guild);
  this.plugin.nonFatalError(error, 'confession delete');

  return t.errors.deleteFailed({ error: error.errorMessage ?? t.base.errors.unknownError() });
 };

 deleteByAuthor = async (
  settings: ConfessionSetting,
  confession: ConfessionRow,
 ): Promise<string | null> => {
  const api = await this.plugin.getAPI(settings.guild);
  const targets = removalTargets(confession.channel, confession.thread);
  const meta = { origin, reason: 'Confession deleted by its author' };

  if (targets.thread) {
   const res = await api.channels.delete(targets.thread, meta);
   if (res instanceof RequestHandlerError && !targets.message) return this.failed(settings, res);
   if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'confession delete thread');
  }

  if (targets.message && confession.channel && confession.message) {
   const res = await api.channels.deleteMessage(confession.channel, confession.message, meta);
   if (res instanceof RequestHandlerError) return this.failed(settings, res);
  }

  await this.plugin.confessions.remove(confession);
  await this.plugin.confessionLog.record(settings, {
   kind: ConfessionLogKind.Deleted,
   number: confession.number,
   parentNumber: await this.parentNumber(confession),
   author: confession.author,
   actor: null,
   content: confession.content,
   media: confession.media,
  });

  return null;
 };
}
