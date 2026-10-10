export const bumpKeyPrefix = 'bump:';

export const bumpKey = (settingsId: string, guildId: string) =>
 `${bumpKeyPrefix}${settingsId}:${guildId}`;

export const parseBumpKey = (raw: string): { settingsId: string; guildId: string } | null => {
 if (!raw.startsWith(bumpKeyPrefix)) return null;

 const [settingsId, guildId, ...rest] = raw.slice(bumpKeyPrefix.length).split(':');
 if (!settingsId?.length || !guildId?.length || rest.length) return null;

 return { settingsId, guildId };
};
