import { RequestHandlerError } from '@ayako/api';
import {
 ConfessionState,
 type Confession as ConfessionRow,
 type ConfessionSetting,
} from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import {
 arm,
 dataKey,
 disarm,
 isArmed,
 scanDataKeys,
 stripDataPrefix,
 stripMarkerPrefix,
} from '../../../Util/schedule.js';
import type ConfessionsPlugin from '../Plugin.js';
import { ConfessionLogKind } from '../Util/logContainer.js';
import { removalTargets } from '../Util/threads.js';

const delPrefix = 'confessions:del:';
const postPrefix = 'confessions:post:';
const cooldownPrefix = 'confessions:cd:';

const origin = 'Confessions';

const delKey = (guildId: string, channelId: string, messageId: string) =>
 `${delPrefix}${guildId}:${channelId}:${messageId}`;

const parseDelKey = (
 key: string,
): { guildId: string; channelId: string; messageId: string } | null => {
 if (!key.startsWith(delPrefix)) return null;

 const [guildId, channelId, messageId] = key.slice(delPrefix.length).split(':');
 return guildId && channelId && messageId ? { guildId, channelId, messageId } : null;
};

export default class ConfessionSchedule {
 plugin: ConfessionsPlugin;
 client: Client;

 constructor(plugin: ConfessionsPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 cooldownKey = (guildId: string, identity: string) =>
  `${cooldownPrefix}${guildId}:${identity}`;

 onCooldown = (guildId: string, identity: string): Promise<boolean> =>
  isArmed.call(this.client, this.cooldownKey(guildId, identity)) as Promise<boolean>;

 armCooldown = async (settings: ConfessionSetting, identity: string): Promise<void> => {
  const seconds = Number(settings.cooldown);
  if (seconds <= 0) return;

  await arm.call(this.client, this.cooldownKey(settings.guild, identity), '1', seconds);
 };

 armPost = async (confessionId: string, seconds: number): Promise<void> => {
  await arm.call(this.client, `${postPrefix}${confessionId}`, '1', Math.max(1, seconds));
 };

 armDelete = async (
  settings: ConfessionSetting,
  channelId: string,
  messageId: string,
 ): Promise<void> => {
  const seconds = Number(settings.deleteAfter);
  if (seconds <= 0) return;

  await arm.call(this.client, delKey(settings.guild, channelId, messageId), '1', seconds);
 };

 disarmDelete = async (guildId: string, channelId: string, messageId: string): Promise<void> => {
  await disarm.call(this.client, delKey(guildId, channelId, messageId));
 };

 private dropThread = async (guildId: string, threadId: string): Promise<void> => {
  const api = await this.plugin.getAPI(guildId);
  const res = await api.channels.delete(threadId, {
   origin,
   reason: 'Deleting expired confession thread',
  });

  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'schedule delete thread');
 };

 private dropMessage = async (
  guildId: string,
  channelId: string,
  messageId: string,
 ): Promise<void> => {
  const api = await this.plugin.getAPI(guildId);
  const res = await api.channels.deleteMessage(channelId, messageId, {
   origin,
   reason: 'Deleting expired confession',
  });

  if (res instanceof RequestHandlerError) this.plugin.nonFatalError(res, 'schedule delete');
 };

 private markRemoved = async (messageId: string): Promise<ConfessionRow | null> => {
  const row = await this.client.db.client.confession.findFirst({ where: { message: messageId } });

  await this.client.db.client.confession
   .updateMany({
    where: { message: messageId },
    data: { state: ConfessionState.Removed, content: null, media: null },
   })
   .catch((error: Error) => this.plugin.nonFatalError(error, 'schedule delete state'));

  return row;
 };

 private removeConfession = async (
  guildId: string,
  channelId: string,
  messageId: string,
 ): Promise<void> => {
  await disarm.call(this.client, delKey(guildId, channelId, messageId));

  const row = await this.markRemoved(messageId);
  const targets = removalTargets(row?.channel ?? channelId, row?.thread ?? null);

  if (targets.thread) await this.dropThread(guildId, targets.thread);
  if (targets.message) await this.dropMessage(guildId, channelId, messageId);
 };

 private releasePost = async (confessionId: string): Promise<void> => {
  await disarm.call(this.client, `${postPrefix}${confessionId}`);

  const confession = await this.plugin.confessions.byId(confessionId);
  if (!confession || confession.state !== ConfessionState.Pending) return;

  const settings = await this.plugin.confessions.settings(confession.guild);
  if (!settings) return;
  if (!(await this.plugin.confessions.claim(confession.id))) return;

  const failure = await this.plugin.publisher.publish(settings, confession);
  if (!failure) return;

  await this.plugin.confessions.discard(confession.id);
  await this.plugin.confessionLog.record(settings, {
   kind: ConfessionLogKind.Failed,
   number: confession.number,
   parentNumber: await this.plugin.moderation.parentNumber(confession),
   author: confession.author,
   actor: null,
   content: confession.content,
   media: confession.media,
   reason: failure,
  });
 };

 onScheduleExpired = async (rawKey: string): Promise<void> => {
  if (!this.plugin.isEnabled()) return;

  const key = stripMarkerPrefix(rawKey);

  if (key.startsWith(postPrefix)) {
   await this.releasePost(key.slice(postPrefix.length)).catch((error: Error) =>
    this.plugin.nonFatalError(error, 'releasePost'),
   );
   return;
  }

  const parsed = parseDelKey(key);
  if (!parsed) return;

  await this.removeConfession(parsed.guildId, parsed.channelId, parsed.messageId).catch(
   (error: Error) => this.plugin.nonFatalError(error, 'onScheduleExpired'),
  );
 };

 reconcile = async (): Promise<void> => {
  if (!this.client.cache.scheduleDb) return;

  const keys = await scanDataKeys.call(this.client, `${dataKey('confessions:')}*`);

  for (const raw of keys) {
   const key = stripDataPrefix(raw);
   if (key.startsWith(cooldownPrefix)) continue;
   if (await isArmed.call(this.client, key)) continue;

   if (key.startsWith(postPrefix)) {
    await this.releasePost(key.slice(postPrefix.length)).catch((error: Error) =>
     this.plugin.nonFatalError(error, 'reconcile releasePost'),
    );
    continue;
   }

   const parsed = parseDelKey(key);
   if (!parsed) continue;

   await this.removeConfession(parsed.guildId, parsed.channelId, parsed.messageId).catch(
    (error: Error) => this.plugin.nonFatalError(error, 'reconcile delete'),
   );
  }
 };
}
