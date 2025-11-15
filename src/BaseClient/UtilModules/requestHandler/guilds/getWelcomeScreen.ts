import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { cache } from '../../../Client.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the welcome screen for a guild.
 * @param guildId - The ID of the guild to retrieve the welcome screen for.
 * @returns A Promise that resolves with the welcome screen data if successful,
 * or rejects with a DiscordAPIError if unsuccessful.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getWelcomeScreen(guildId)
  .then((welcomeScreen) => {
   cache.welcomeScreens.set(welcomeScreen, guildId);
   return cache.welcomeScreens.apiToR(welcomeScreen);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
