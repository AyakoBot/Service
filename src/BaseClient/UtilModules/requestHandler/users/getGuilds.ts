import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPICurrentUserGuildsQuery } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Returns the guilds for the current user.
 * @param guildId - The guild ID (may be undefined for global operations).
 * @param query - Optional query parameters for the API request.
 * @returns A promise that resolves with the guilds for the current user,
 * or rejects with a DiscordAPIError.
 */
export default async (guildId: string | undefined, query?: RESTGetAPICurrentUserGuildsQuery) =>
 (await getAPI(guildId)).users.getGuilds(query).catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
