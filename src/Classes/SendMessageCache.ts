import { getPathFromError, logger, type RMessage } from '@ayako/utility';
import { scheduleJob, type Job } from 'node-schedule';

import type { MessagePayload } from './abstracts/MessagePayload.js';
import type Client from './Client.js';

type Deferred<T> = {
 promise: Promise<T>;
 resolve: (value: T) => void;
 reject: (reason?: unknown) => void;
};

type Entry = {
 job: Job;
 channelId: string;
 guildId: string | '@me';
 payloads: MessagePayload[];
 deferreds: Deferred<RMessage | undefined>[];
};

export default class SendMessageCache {
 client: typeof Client.prototype;
 private cache: Map<string, Entry> = new Map();

 constructor(client: typeof Client.prototype) {
  this.client = client;
  logger.debug('[SendMessageCache] Initialized');
 }

 private createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
   resolve = res;
   reject = rej;
  });
  return { promise, resolve, reject };
 };

 queueMessage = async (
  rawChannelId: string | Promise<string | undefined>,
  guildId: string | '@me',
  payload: MessagePayload,
  timeout: number,
 ): Promise<RMessage | undefined> => {
  const channelId = await rawChannelId;
  if (!channelId) {
   logger.silly('[SendMessageCache] No channelId resolved, skipping message');
   return undefined;
  }

  logger.silly('[SendMessageCache] Queueing message for channel:', channelId);

  const existing = this.cache.get(channelId);
  if (existing) {
   const deferred = this.createDeferred<RMessage | undefined>();
   existing.payloads.push(payload);
   existing.deferreds.push(deferred);
   logger.silly('[SendMessageCache] Added to existing queue, count:', existing.payloads.length);

   if (existing.payloads.length >= 10) {
    logger.debug('[SendMessageCache] Queue full (10), sending immediately');
    await this.send(existing);
   }

   return deferred.promise;
  }

  const deferred = this.createDeferred<RMessage | undefined>();
  const entry: Entry = {
   channelId,
   guildId,
   payloads: [payload],
   job: { cancel: () => undefined } as unknown as Job,
   deferreds: [deferred],
  };

  if (payload.content || timeout <= 0) {
   logger.silly('[SendMessageCache] Immediate send (content or no timeout)');
   await this.send(entry);
   return deferred.promise;
  }

  this.cache.set(channelId, entry);
  logger.silly('[SendMessageCache] Scheduled send in', timeout, 'ms');

  entry.job = scheduleJob(getPathFromError(new Error()), new Date(Date.now() + timeout), () =>
   this.send(entry),
  );

  return deferred.promise;
 };

 private send = async (entry: Entry) => {
  this.cache.delete(entry.channelId);
  entry.job.cancel();

  logger.debug('[SendMessageCache] Sending', entry.payloads.length, 'payloads to', entry.channelId);

  const payloads = entry.payloads.map((p) => p.getAPIPayload());

  try {
   const apiMessage = await (
    await this.client.getAPI(entry.guildId)
   ).channels.createMessage(entry.channelId, {
    embeds: payloads.flatMap((p) => p.embeds ?? []),
    content: payloads
     .map((p) => p.content)
     .filter(Boolean)
     .join('\n'),
    files: payloads.flatMap((p) => p.files ?? []),
    components: payloads.flatMap((p) => p.components ?? []),
    allowed_mentions: { parse: [], replied_user: false, roles: [], users: [] },
   });

   logger.silly('[SendMessageCache] Message sent successfully:', apiMessage.id);
   const rMessage = this.client.cache.messages.apiToR(apiMessage, entry.guildId);
   entry.deferreds.forEach((d) => d.resolve(rMessage));
  } catch (error) {
   logger.error('[SendMessageCache] Failed to send message to', entry.channelId, error);
   entry.deferreds.forEach((d) => d.reject(error));
  }
 };
}
