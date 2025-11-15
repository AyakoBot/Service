import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the templates for a given guild.
 * @param guildId - The ID of the guild to retrieve templates for.
 * @returns A promise that resolves with an array of guild template data.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getTemplates(guildId)
  .then((templates) => templates)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
