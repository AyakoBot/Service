import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the auto moderation rules for a given guild.
 * @param guildId - The ID of the guild to retrieve the auto moderation rules for.
 * @returns A promise that resolves with an array of parsed auto moderation rules.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getAutoModerationRules(guildId)
  .then((rules) => {
   rules.forEach((r) => cache.automods.set(r));
   return rules.map((r) => cache.automods.apiToR(r));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
