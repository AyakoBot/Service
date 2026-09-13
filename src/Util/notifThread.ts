export interface TrackedThread {
 key: string;
 threadId: string;
 guildId: string;
 channelId: string;
 userId: string;
 armedAt: number;
}

export const threadKeyOf = (prefix: string, threadId: string): string => `${prefix}${threadId}`;

export const threadIdOfKey = (prefix: string, key: string): string => key.slice(prefix.length);

export const encodeThreadData = (
 guildId: string,
 channelId: string,
 userId: string,
 now: number = Date.now(),
): string => [guildId, channelId, userId, now].join(':');

export const decodeThreadData = (
 raw: string,
): { guildId: string; channelId: string; userId: string; armedAt: number } | null => {
 const [guildId, channelId, userId, armedAt] = raw.split(':');
 if (!guildId || !channelId || !userId) return null;

 return { guildId, channelId, userId, armedAt: Number(armedAt) || 0 };
};

export const oldestTracked = (
 tracked: TrackedThread[],
 channelId: string,
): TrackedThread | null => {
 const candidates = tracked.filter((thread) => thread.channelId === channelId);
 if (!candidates.length) return null;

 return candidates.reduce((a, b) => (a.armedAt <= b.armedAt ? a : b));
};
