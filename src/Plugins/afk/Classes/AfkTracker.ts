import type { RMessage } from '@ayako/utility';

import type Client from '../../../Classes/Client.js';
import { AfkKey } from '../Enums.js';
import type AFKPlugin from '../Plugin.js';
import { previewOf } from '../Util/text.js';

const noticeCooldownMs = 10000;
const pingLimit = 20;
const pingTtlSeconds = 30 * 24 * 60 * 60;
const returnTtlSeconds = 120;

const keyOf = (prefix: AfkKey, guild: string, user: string) => `${prefix}:${guild}:${user}`;

export interface AfkPing {
 author: string;
 channel: string;
 message: string;
 preview: string;
 at: number;
}

export interface AfkReturn {
 reason: string | null;
 pings: AfkPing[];
}

const parsed = <T>(raw: string | null, fallback: T): T => {
 if (!raw) return fallback;

 try {
  return JSON.parse(raw) as T;
 } catch {
  return fallback;
 }
};

export default class AfkTracker {
 plugin: AFKPlugin;
 client: Client;

 constructor(plugin: AFKPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 claimNotice = async (guild: string, user: string): Promise<boolean> =>
  (await this.client.cache.cacheDb.set(
   keyOf(AfkKey.Notice, guild, user),
   '1',
   'PX',
   noticeCooldownMs,
   'NX',
  )) === 'OK';

 recordPing = async (guild: string, user: string, msg: RMessage): Promise<void> => {
  const ping: AfkPing = {
   author: msg.author_id,
   channel: msg.channel_id,
   message: msg.id,
   preview: previewOf(msg.content ?? ''),
   at: Date.now(),
  };

  await this.writePings(guild, user, [...(await this.readPings(guild, user)), ping]);
 };

 takePings = async (guild: string, user: string, since: number): Promise<AfkPing[]> => {
  const pings = await this.readPings(guild, user);
  await this.client.cache.cacheDb.del(keyOf(AfkKey.Pings, guild, user));

  return pings.filter((ping) => ping.at >= since);
 };

 restorePings = async (guild: string, user: string, pings: AfkPing[]): Promise<void> => {
  if (!pings.length) return;

  const at = Date.now();
  await this.writePings(
   guild,
   user,
   pings.map((ping) => ({ ...ping, at })),
  );
 };

 saveReturn = async (guild: string, user: string, state: AfkReturn): Promise<void> => {
  await this.client.cache.cacheDb.set(
   keyOf(AfkKey.Return, guild, user),
   JSON.stringify(state),
   'EX',
   returnTtlSeconds,
  );
 };

 takeReturn = async (guild: string, user: string): Promise<AfkReturn | null> => {
  const key = keyOf(AfkKey.Return, guild, user);
  const raw = await this.client.cache.cacheDb.get(key);
  await this.client.cache.cacheDb.del(key);

  return parsed<AfkReturn | null>(raw, null);
 };

 private readPings = async (guild: string, user: string): Promise<AfkPing[]> =>
  parsed<AfkPing[]>(await this.client.cache.cacheDb.get(keyOf(AfkKey.Pings, guild, user)), []);

 private writePings = async (guild: string, user: string, pings: AfkPing[]): Promise<void> => {
  await this.client.cache.cacheDb.set(
   keyOf(AfkKey.Pings, guild, user),
   JSON.stringify(pings.slice(-pingLimit)),
   'EX',
   pingTtlSeconds,
  );
 };
}
