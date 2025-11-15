import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the voice regions for a given guild.
 * @param guildId - The ID of the guild to retrieve the voice regions for.
 * @returns A promise that resolves with an array of voice regions for the guild.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getVoiceRegions(guildId)
  .then((result) => result)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
