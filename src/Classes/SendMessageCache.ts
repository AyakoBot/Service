import { inspect } from 'node:util';

import { RequestHandlerError } from '@ayako/api';
import { getPathFromError, logger, type RMessage } from '@ayako/utility';
import type { APIAllowedMentions, CreateMessageOptions } from '@discordjs/core';
import { MessageFlags } from 'discord-api-types/v10';
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
 debugInfo: { origin: string; reason: string }[];
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

 private isCV2 = (payload: MessagePayload): boolean =>
  Boolean(payload.flags & MessageFlags.IsComponentsV2);

 private appendToEntry = async (
  entry: Entry,
  payload: MessagePayload,
 ): Promise<RMessage | undefined> => {
  const deferred = this.createDeferred<RMessage | undefined>();
  entry.payloads.push(payload);
  entry.deferreds.push(deferred);
  entry.debugInfo.push({ origin: payload.origin, reason: payload.reason });
  logger.silly('[SendMessageCache] Added to existing queue, count:', entry.payloads.length);

  if (entry.payloads.length >= 10) {
   logger.debug('[SendMessageCache] Queue full (10), sending immediately');
   await this.send(entry);
  }

  return deferred.promise;
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
  if (existing && this.isCV2(existing.payloads[0]) !== this.isCV2(payload)) {
   this.cache.delete(channelId);
   existing.job.cancel();
   void this.send(existing);
  } else if (existing) {
   return this.appendToEntry(existing, payload);
  }

  const deferred = this.createDeferred<RMessage | undefined>();
  const entry: Entry = {
   channelId,
   guildId,
   payloads: [payload],
   job: { cancel: () => undefined } as unknown as Job,
   deferreds: [deferred],
   debugInfo: [{ origin: payload.origin, reason: payload.reason }],
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

 private send = async (entry: Entry, trace: Error = new Error()) => {
  this.cache.delete(entry.channelId);
  entry.job.cancel();

  logger.debug('[SendMessageCache] Sending', entry.payloads.length, 'payloads to', entry.channelId);

  const payloads = entry.payloads.map((p) => p.getAPIPayload());
  const flags = payloads.reduce((acc, p) => acc | (p.flags ?? 0), 0) || undefined;
  const api = entry.payloads.find((p) => p.api)?.api ?? (await this.client.getAPI(entry.guildId));

  try {
   const apiMessage = await api.channels
    .createMessage(
     entry.channelId,
     {
      embeds: payloads.flatMap((p) => p.embeds ?? []),
      content: payloads
       .map((p) => p.content)
       .filter(Boolean)
       .join('\n'),
      files: payloads.flatMap((p) => p.files ?? []),
      components: payloads.flatMap((p) => p.components ?? []),
      allowed_mentions: this.mergeAllowedMentions(payloads.map((p) => p.allowed_mentions)),
      message_reference: payloads.find((p) => p.message_reference)?.message_reference,
      flags,
     },
     {
      origin: entry.debugInfo.map((d) => d.origin).join(', '),
      reason: entry.debugInfo.map((d) => d.reason).join(', '),
     },
    )
    .catch((e: Error) =>
     new RequestHandlerError({ guildId: entry.guildId, channelId: entry.channelId }, e.message)
      .setAction('createMessage')
      .setAppId(this.client.user?.id || '')
      .setDetail(String(trace.stack))
      .setError(e),
    );

   if (apiMessage instanceof RequestHandlerError) {
    logger.debug('[SendMessageCache] 1 Failed to send message to', entry.channelId);
    logger.debug(inspect(apiMessage));
    logger.debug(inspect(apiMessage.cause));
    return;
   }

   logger.silly('[SendMessageCache] Message sent successfully:', apiMessage.id);
   const rMessage = this.client.cache.messages.apiToR(apiMessage, entry.guildId);
   entry.deferreds.forEach((d) => d.resolve(rMessage));
  } catch (error) {
   logger.error('[SendMessageCache] 2 Failed to send message to', entry.channelId, error);
   api.emit('error', error);
   entry.deferreds.forEach((d) => d.reject(error));
  }
 };

 private mergeAllowedMentions(
  mentionsArray: (CreateMessageOptions['allowed_mentions'] | undefined)[],
 ): APIAllowedMentions {
  const merged: APIAllowedMentions = { parse: [], users: [], roles: [], replied_user: true };

  for (const mentions of mentionsArray) {
   if (!mentions) continue;
   if (mentions.parse) merged.parse!.push(...mentions.parse);
   if (mentions.users) merged.users!.push(...mentions.users);
   if (mentions.roles) merged.roles!.push(...mentions.roles);
   if (mentions.replied_user === false) merged.replied_user = false;
  }

  return merged;
 }
}
