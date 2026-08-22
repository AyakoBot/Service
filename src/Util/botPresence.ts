import type { Cache } from '@ayako/utility';

const presenceKey = (guildId: string) => `gw:presence:${guildId}`;

export const isBotPresent = async (
 cache: Cache,
 guildId: string,
 botKey: string,
): Promise<boolean> => {
 const members = await cache.cacheDb.smembers(presenceKey(guildId));
 return members.includes(botKey);
};
