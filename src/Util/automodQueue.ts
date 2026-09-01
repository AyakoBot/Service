import { inspect } from 'node:util';

import { GatewayDispatchEvents } from '@discordjs/core';
import type { GatewayMessageCreateDispatchData } from 'discord-api-types/v10';

import type Client from '../Classes/Client.js';

import { startTldRefresh } from './urlScan.js';

export enum StageResult {
 Continue = 'continue',
 Handled = 'handled',
}

export type AutomodStage = (data: GatewayMessageCreateDispatchData) => Promise<StageResult>;

export const MAX_LINKS_PER_MESSAGE = 10;
export const QUEUE_DEBOUNCE_SECONDS = 5;

enum AutomodQueueKey {
 ListPrefix = 'automod:queue:',
 DebouncePrefix = 'automod:debounce:',
}

export const walkStages = async (
 stages: AutomodStage[],
 data: GatewayMessageCreateDispatchData,
 onError?: (error: unknown) => void,
): Promise<void> => {
 for (const stage of stages) {
  let result: StageResult;
  try {
   result = await stage(data);
  } catch (error) {
   onError?.(error);
   result = StageResult.Continue;
  }
  if (result === StageResult.Handled) return;
 }
};

export const updateHasContentChange = (
 data: Partial<Pick<GatewayMessageCreateDispatchData, 'edited_timestamp'>>,
): boolean => Boolean(data.edited_timestamp);

export default class AutomodQueue {
 private client: Client;
 private stages: AutomodStage[] = [];
 private timers: Map<string, NodeJS.Timeout> = new Map();
 private started = false;

 constructor(client: Client) {
  this.client = client;
 }

 registerStage = (stage: AutomodStage) => {
  this.stages.push(stage);
 };

 requeue = (data: GatewayMessageCreateDispatchData) => this.enqueue(data);

 init = async () => {
  if (this.started) return;
  this.started = true;

  this.client.cache.on(
   GatewayDispatchEvents.MessageCreate,
   (data: GatewayMessageCreateDispatchData) => void this.enqueue(data),
  );
  this.client.cache.on(
   GatewayDispatchEvents.MessageUpdate,
   (data: GatewayMessageCreateDispatchData) => {
    if (!updateHasContentChange(data)) return;
    void this.enqueue(data);
   },
  );

  startTldRefresh();
  await this.drainLeftovers();
 };

 private get db() {
  return this.client.cache.cacheDb;
 }

 private listKey = (guildId: string, userId: string) =>
  `${AutomodQueueKey.ListPrefix}${guildId}:${userId}`;

 private debounceKey = (guildId: string, userId: string) =>
  `${AutomodQueueKey.DebouncePrefix}${guildId}:${userId}`;

 private timerKey = (guildId: string, userId: string) => `${guildId}:${userId}`;

 private enqueue = async (data: GatewayMessageCreateDispatchData) => {
  if (!data.guild_id || !data.author || !this.stages.length) return;

  const guildId = data.guild_id;
  const userId = data.author.id;

  await this.db.lpush(this.listKey(guildId, userId), JSON.stringify(data));

  if (this.timers.has(this.timerKey(guildId, userId))) return;

  const fresh = await this.db.set(
   this.debounceKey(guildId, userId),
   '1',
   'NX',
   'EX',
   QUEUE_DEBOUNCE_SECONDS,
  );

  if (fresh) await this.drain(guildId, userId);
  else this.armTimer(guildId, userId);
 };

 private drain = async (guildId: string, userId: string) => {
  this.timers.delete(this.timerKey(guildId, userId));

  const raw = await this.db.rpop(this.listKey(guildId, userId));
  if (!raw) return;

  await this.db.set(this.debounceKey(guildId, userId), '1', 'EX', QUEUE_DEBOUNCE_SECONDS);

  const data = this.deserialize(raw);
  if (data) await walkStages(this.stages, data, (error) => this.onStageError(error));

  const remaining = await this.db.llen(this.listKey(guildId, userId));
  if (remaining > 0) this.armTimer(guildId, userId);
 };

 private armTimer = (guildId: string, userId: string) => {
  const key = this.timerKey(guildId, userId);
  if (this.timers.has(key)) return;

  const timer = setTimeout(
   () => void this.drain(guildId, userId),
   QUEUE_DEBOUNCE_SECONDS * 1000,
  );
  this.timers.set(key, timer);
 };

 private drainLeftovers = async () => {
  if (!this.stages.length) return;

  const keys = await this.scanQueueKeys();
  await Promise.all(
   keys.map((key) => {
    const rest = key.slice(AutomodQueueKey.ListPrefix.length);
    const separator = rest.indexOf(':');
    if (separator < 0) return Promise.resolve();
    return this.drain(rest.slice(0, separator), rest.slice(separator + 1));
   }),
  );
 };

 private scanQueueKeys = async (): Promise<string[]> => {
  const keys: string[] = [];
  let cursor = '0';

  do {
   const [next, batch] = (await this.db.call(
    'SCAN',
    cursor,
    'MATCH',
    `${AutomodQueueKey.ListPrefix}*`,
    'COUNT',
    200,
   )) as [string, string[]];
   cursor = next;
   keys.push(...batch);
  } while (cursor !== '0');

  return [...new Set(keys)];
 };

 private deserialize = (raw: string): GatewayMessageCreateDispatchData | null => {
  try {
   return JSON.parse(raw) as GatewayMessageCreateDispatchData;
  } catch {
   return null;
  }
 };

 private onStageError = (error: unknown) =>
  this.client.logger.error(`[AutomodQueue] Stage failed: ${inspect(error)}`);
}
