import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves an auto moderation rule from the API.
 * @param guildId - The ID of the guild to retrieve the rule from.
 * @param ruleId - The ID of the rule to retrieve.
 * @returns A promise that resolves with the retrieved auto moderation rule.
 */
export default async (guildId: string, ruleId: string) =>
 (await getAPI(guildId)).guilds
  .getAutoModerationRule(guildId, ruleId)
  .then((r) => {
   cache.automods.set(r);
   return cache.automods.apiToR(r);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
