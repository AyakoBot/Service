import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Returns a Promise that resolves with the guild template data.
 * If an error occurs, it will log the error and return the DiscordAPIError.
 * @param guildId The ID of the guild to get the template for.
 * @returns A Promise that resolves with the guild template data.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getTemplate(guildId)
  .then((t) => t)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
