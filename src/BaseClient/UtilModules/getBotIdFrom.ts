import DataBase from '../DataBase.js';
import cache from './cache.js';

/**
 * Extracts the bot ID from a Discord bot token.
 * @param t The Discord bot token.
 * @returns The bot ID.
 */
export const token = (t: string) => Buffer.from(t.split('.')[0], 'base64').toString();

/**
 * Returns the bot ID for a given guild id.
 * @param guildId - The guild Id.
 * @returns The bot ID for the guild.
 */
export const guild = async (guildId: string) => {
 if (!guildId) {
  const { user } = await import('../Client.js');

  return user.id;
 }

 if (cache.customClients.get(guildId)) return cache.customClients.get(guildId)!;

 const settings = await DataBase.customclients.findUnique({
  where: { guildid: guildId, token: { not: null } },
  select: { token: true },
 });
 if (!settings || !settings.token) {
  const { user } = await import('../Client.js');

  cache.customClients.set(guildId, user.id);
  return user.id;
 }

 const id = token(settings.token);
 cache.customClients.set(guildId, id);

 return id;
};
