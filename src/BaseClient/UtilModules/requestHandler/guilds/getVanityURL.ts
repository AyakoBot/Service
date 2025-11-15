import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the vanity URL for a given guild.
 * @param guildId The ID of the guild to retrieve the vanity URL for.
 * @returns A Promise that resolves with the vanity URL data,
 * or rejects with a DiscordAPIError if the vanity URL is inaccessible.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getVanityURL(guildId)
  .then((result) => result)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
