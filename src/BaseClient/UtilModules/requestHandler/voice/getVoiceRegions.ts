import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the available voice regions.
 * @param guildId - The guild ID (may be undefined for global voice regions).
 * @returns A promise that resolves with an array of available voice regions.
 */
export default async (guildId?: string) =>
 (await getAPI(guildId)).voice
  .getVoiceRegions()
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
