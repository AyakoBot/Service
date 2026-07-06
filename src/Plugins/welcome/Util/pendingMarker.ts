import type WelcomePlugin from '../Plugin.js';

const markerTtlSeconds = 604800;
const markerKey = (guildId: string, userId: string) => `welcome:pending:${guildId}:${userId}`;

export const setPendingMarker = function (this: WelcomePlugin, guildId: string, userId: string) {
 return this.client.cache.cacheDb.set(markerKey(guildId, userId), '1', 'EX', markerTtlSeconds);
};

export const consumePendingMarker = async function (
 this: WelcomePlugin,
 guildId: string,
 userId: string,
) {
 const key = markerKey(guildId, userId);
 const marked = await this.client.cache.cacheDb.get(key);
 if (marked) await this.client.cache.cacheDb.del(key);
 return !!marked;
};
