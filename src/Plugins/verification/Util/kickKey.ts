export const kickKeyPrefix = 'verification:kick:';

export const kickKey = (guildId: string, userId: string) =>
 `${kickKeyPrefix}${guildId}:${userId}`;

export const parseKickKey = (raw: string): { guildId: string; userId: string } | null => {
 if (!raw.startsWith(kickKeyPrefix)) return null;
 const [guildId, userId] = raw.slice(kickKeyPrefix.length).split(':');
 return guildId && userId ? { guildId, userId } : null;
};
