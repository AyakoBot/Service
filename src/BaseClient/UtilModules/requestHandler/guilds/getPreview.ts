import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Returns the preview of a guild.
 * @param guildId - The ID of the guild to get the preview for.
 * @returns A promise that resolves with the guild preview data.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getPreview(guildId)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
