import { AuditLogEvent } from 'discord-api-types/v10';

import type WelcomePlugin from '../Plugin.js';

export const involuntaryActions = [
 AuditLogEvent.MemberKick,
 AuditLogEvent.MemberPrune,
 AuditLogEvent.MemberBanAdd,
];

const markerTtlSeconds = 60;
const settleMs = 3000;

const markerKey = (guildId: string, userId: string) => `welcome:involuntary:${guildId}:${userId}`;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const markInvoluntary = function (this: WelcomePlugin, guildId: string, userId: string) {
 return this.client.cache.cacheDb.set(markerKey(guildId, userId), '1', 'EX', markerTtlSeconds);
};

export const leftInvoluntarily = async function (
 this: WelcomePlugin,
 guildId: string,
 userId: string,
) {
 await wait(settleMs);

 const key = markerKey(guildId, userId);
 const marked = await this.client.cache.cacheDb.get(key);
 if (marked) {
  await this.client.cache.cacheDb.del(key);
  return true;
 }

 return !!(await this.client.cache.bans.get(guildId, userId));
};
