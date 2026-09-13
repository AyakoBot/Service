import { RequestHandlerError, type API } from '@ayako/api';
import type { RThread } from '@ayako/utility';
import {
 ChannelType,
 type APIMessage,
 type GatewayDispatchEvents,
 type RESTPostAPIChannelMessageJSONBody,
} from 'discord-api-types/v10';

import {
 decodeThreadData,
 encodeThreadData,
 oldestTracked,
 threadIdOfKey,
 threadKeyOf,
 type TrackedThread,
} from '../Util/notifThread.js';
import {
 arm,
 dataKey,
 disarm,
 isArmed,
 scanDataKeys,
 stripDataPrefix,
 stripMarkerPrefix,
} from '../Util/schedule.js';

import type Plugin from './abstracts/Plugin.js';
import type { BaseLanguage } from './abstracts/Plugin.js';
import type Client from './Client.js';

const maxActiveThreadsPerChannel = 200;
const fallbackArchiveMinutes = 60;

type NotifierPlugin = Pick<
 Plugin<GatewayDispatchEvents, BaseLanguage>,
 'client' | 'getAPI' | 'nonFatalError'
>;

export interface MemberNotifierConfig {
 keyPrefix: string;
 threadName: string;
 origin: string;
}

export default class MemberNotifier {
 plugin: NotifierPlugin;
 client: Client;
 config: MemberNotifierConfig;

 constructor(plugin: NotifierPlugin, config: MemberNotifierConfig) {
  this.plugin = plugin;
  this.client = plugin.client;
  this.config = config;
 }

 deliverToDm = async (
  guildId: string,
  userId: string,
  body: RESTPostAPIChannelMessageJSONBody,
  reason: string,
 ): Promise<APIMessage | null> => {
  const api = await this.plugin.getAPI(guildId);
  const dm = await api.users.createDM(userId, { origin: this.config.origin, reason });
  if (dm instanceof RequestHandlerError) return null;

  const sent = await api.channels.createDirectMessage(dm.id, body, {
   origin: this.config.origin,
   reason,
  });
  if (sent instanceof RequestHandlerError) return null;

  return sent;
 };

 deliverToThread = async (
  guildId: string,
  userId: string,
  parentChannel: string,
  body: RESTPostAPIChannelMessageJSONBody,
  reason: string,
 ): Promise<boolean> => {
  const api = await this.plugin.getAPI(guildId);

  const member = await api.guilds.getMember(guildId, userId, {
   origin: this.config.origin,
   reason,
  });
  if (member instanceof RequestHandlerError) return false;

  if (await this.reuseThread(api, guildId, userId, parentChannel, body, reason)) return true;

  return this.createThreadAndSend(api, guildId, userId, parentChannel, body, reason);
 };

 onScheduleExpired = async (rawKey: string): Promise<void> => {
  const key = stripMarkerPrefix(rawKey);
  if (!key.startsWith(this.config.keyPrefix)) return;

  await this.fireThreadDeletion(key).catch((error: Error) =>
   this.plugin.nonFatalError(error, 'MemberNotifier.expired'),
  );
 };

 reconcile = async (): Promise<void> => {
  if (!this.client.cache.scheduleDb) return;

  const raws = await scanDataKeys.call(this.client, `${dataKey(this.config.keyPrefix)}*`);

  for (const raw of raws) {
   const key = stripDataPrefix(raw);
   if (await isArmed.call(this.client, key)) continue;

   await this.fireThreadDeletion(key).catch((error: Error) =>
    this.plugin.nonFatalError(error, 'MemberNotifier.reconcile'),
   );
  }
 };

 private reuseThread = async (
  api: API,
  guildId: string,
  userId: string,
  parentChannel: string,
  body: RESTPostAPIChannelMessageJSONBody,
  reason: string,
 ): Promise<boolean> => {
  const tracked = await this.listTracked();
  const entry = tracked.find(
   (thread) =>
    thread.guildId === guildId && thread.userId === userId && thread.channelId === parentChannel,
  );
  if (!entry) return false;

  const thread = await this.client.cache.threads.get(entry.threadId);
  if (!thread) {
   await disarm.call(this.client, entry.key);
   return false;
  }

  await api.threads.addMember(entry.threadId, userId, {
   origin: this.config.origin,
   reason,
  });

  const sent = await api.channels.createMessage(entry.threadId, body, {
   origin: this.config.origin,
   reason,
  });
  if (sent instanceof RequestHandlerError) {
   await disarm.call(this.client, entry.key);
   return false;
  }

  await this.armThreadDeletion(thread, guildId, userId);
  return true;
 };

 private createThreadAndSend = async (
  api: API,
  guildId: string,
  userId: string,
  parentChannel: string,
  body: RESTPostAPIChannelMessageJSONBody,
  reason: string,
 ): Promise<boolean> => {
  if (!(await this.evictIfFull(api, guildId, parentChannel, reason))) return false;

  const thread = await api.channels.createThread(
   parentChannel,
   { name: this.config.threadName, type: ChannelType.PrivateThread, invitable: false },
   undefined,
   { origin: this.config.origin, reason },
  );
  if (thread instanceof RequestHandlerError) return false;

  await this.armThreadDeletion(thread, guildId, userId);

  const added = await api.threads.addMember(thread.id, userId, {
   origin: this.config.origin,
   reason,
  });
  if (added instanceof RequestHandlerError) {
   await this.discardThread(api, thread.id, reason);
   return false;
  }

  const sent = await api.channels.createMessage(thread.id, body, {
   origin: this.config.origin,
   reason,
  });
  if (sent instanceof RequestHandlerError) {
   await this.discardThread(api, thread.id, reason);
   return false;
  }

  const locked = await api.channels.edit(
   thread.id,
   { locked: true },
   { origin: this.config.origin, reason },
  );
  if (locked instanceof RequestHandlerError) {
   this.plugin.nonFatalError(locked, 'MemberNotifier.lockThread');
  }

  return true;
 };

 private evictIfFull = async (
  api: API,
  guildId: string,
  parentChannel: string,
  reason: string,
 ): Promise<boolean> => {
  const active = await api.guilds.getActiveThreads(guildId, {
   origin: this.config.origin,
   reason,
  });
  if (active instanceof RequestHandlerError) return false;

  const count = active.threads.filter((thread) => thread.parent_id === parentChannel).length;
  if (count < maxActiveThreadsPerChannel) return true;

  const oldest = oldestTracked(await this.listTracked(), parentChannel);
  if (!oldest) return false;

  await this.removeThread(api, oldest.threadId, reason);
  await disarm.call(this.client, oldest.key);

  return true;
 };

 private armThreadDeletion = async (
  thread: RThread,
  guildId: string,
  userId: string,
 ): Promise<void> => {
  const key = threadKeyOf(this.config.keyPrefix, thread.id);
  const minutes = thread.thread_metadata?.auto_archive_duration ?? fallbackArchiveMinutes;

  await disarm.call(this.client, key);
  await arm.call(
   this.client,
   key,
   encodeThreadData(guildId, thread.parent_id ?? '', userId),
   minutes * 60,
  );
 };

 private discardThread = async (api: API, threadId: string, reason: string): Promise<void> => {
  await disarm.call(this.client, threadKeyOf(this.config.keyPrefix, threadId));
  await this.removeThread(api, threadId, reason);
 };

 private removeThread = async (api: API, threadId: string, reason: string): Promise<void> => {
  const del = await api.channels.delete(threadId, { origin: this.config.origin, reason });

  if (del instanceof RequestHandlerError) {
   this.plugin.nonFatalError(del, 'MemberNotifier.deleteThread');
  }
 };

 // ponytail: SCAN-backed thread lookup, carried over unchanged; move to a keyed
 // (guild,user)->thread mapping if notification volume ever makes the scan measurable
 private listTracked = async (): Promise<TrackedThread[]> => {
  const raws = await scanDataKeys.call(this.client, `${dataKey(this.config.keyPrefix)}*`);

  const entries = await Promise.all(
   raws.map(async (raw) => {
    const key = stripDataPrefix(raw);
    const value = await this.client.cache.scheduleDb?.get(raw);
    const decoded = value ? decodeThreadData(value) : null;

    return decoded
     ? { key, threadId: threadIdOfKey(this.config.keyPrefix, key), ...decoded }
     : null;
   }),
  );

  return entries.filter((entry): entry is TrackedThread => !!entry);
 };

 private fireThreadDeletion = async (key: string): Promise<void> => {
  const threadId = threadIdOfKey(this.config.keyPrefix, key);
  const value = await this.client.cache.scheduleDb?.get(dataKey(key));
  const decoded = value ? decodeThreadData(value) : null;
  const guildId = decoded?.guildId ?? (await this.client.cache.threads.get(threadId))?.guild_id;

  await disarm.call(this.client, key);
  if (!guildId) return;

  const api = await this.plugin.getAPI(guildId);
  await this.removeThread(api, threadId, 'Deleting expired notification thread');
 };
}
