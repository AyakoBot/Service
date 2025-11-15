import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the onboarding data for a given guild.
 * @param guildId - The ID of the guild to retrieve onboarding data for.
 * @returns A promise that resolves with the guild onboarding data.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getOnboarding(guildId)
  .then((result) => {
   cache.onboardings.set(result);
   return cache.onboardings.apiToR(result);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
