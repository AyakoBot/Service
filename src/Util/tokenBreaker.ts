import type { Cache } from '@ayako/utility';

import { TokenCheckResult } from './tokenCheck.js';

export interface BreakerEntry {
 n: number;
 until: number;
}

export enum BreakerState {
 Closed = 'closed',
 Open = 'open',
 HalfOpen = 'halfOpen',
}

export enum TokenGate {
 Use = 'use',
 Skip = 'skip',
 Invalid = 'invalid',
}

export const BACKOFF_STEP_MS = 5 * 60 * 1000;
export const BACKOFF_MAX_MS = 60 * 60 * 1000;

export const backoffMs = (n: number): number => Math.min(n * BACKOFF_STEP_MS, BACKOFF_MAX_MS);

export const breakerState = (entry: BreakerEntry | null, now: number): BreakerState => {
 if (!entry) return BreakerState.Closed;
 return now < entry.until ? BreakerState.Open : BreakerState.HalfOpen;
};

export interface BreakerStore {
 read(guildId: string, botId: string): Promise<BreakerEntry | null>;
 open(guildId: string, botId: string, prior: BreakerEntry | null, now: number): Promise<void>;
 clear(guildId: string, botId: string): Promise<void>;
}

const breakerKey = (guildId: string, botId: string) => `svc:membercheck:${guildId}:${botId}`;

export class TokenBreaker implements BreakerStore {
 private cache: Cache;

 constructor(cache: Cache) {
  this.cache = cache;
 }

 read = async (guildId: string, botId: string): Promise<BreakerEntry | null> => {
  const raw = await this.cache.cacheDb.get(breakerKey(guildId, botId));
  if (!raw) return null;
  try {
   return JSON.parse(raw) as BreakerEntry;
  } catch {
   return null;
  }
 };

 open = async (
  guildId: string,
  botId: string,
  prior: BreakerEntry | null,
  now: number,
 ): Promise<void> => {
  const n = (prior?.n ?? 0) + 1;
  const until = now + backoffMs(n);
  const key = breakerKey(guildId, botId);
  await this.cache.cacheDb.set(key, JSON.stringify({ n, until } satisfies BreakerEntry));
  await this.cache.cacheDb.pexpire(key, until - now + BACKOFF_STEP_MS);
 };

 clear = async (guildId: string, botId: string): Promise<void> => {
  await this.cache.cacheDb.del(breakerKey(guildId, botId));
 };
}

export const gateToken = async (
 store: BreakerStore,
 guildId: string,
 botId: string,
 now: number,
 probe: () => Promise<TokenCheckResult>,
): Promise<TokenGate> => {
 const entry = await store.read(guildId, botId);
 if (breakerState(entry, now) === BreakerState.Open) return TokenGate.Skip;

 const result = await probe();

 if (result === TokenCheckResult.OK) {
  if (entry) await store.clear(guildId, botId);
  return TokenGate.Use;
 }
 if (result === TokenCheckResult.Invalid) {
  if (entry) await store.clear(guildId, botId);
  return TokenGate.Invalid;
 }
 if (result === TokenCheckResult.NotInGuild) {
  await store.open(guildId, botId, entry, now);
  return TokenGate.Skip;
 }
 return TokenGate.Skip;
};
