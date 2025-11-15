import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves an emoji from the given guild by its ID.
 * @param guildId - The guild to retrieve the emoji from.
 * @param emojiId - The ID of the emoji to retrieve.
 * @returns A Promise that resolves with the retrieved emoji, or rejects with an error.
 */
export default async (guildId: string, emojiId: string) =>
 (await getAPI(guildId)).guilds
  .getEmoji(guildId, emojiId)
  .then((e) => {
   cache.emojis.set(e, guildId);
   return cache.emojis.apiToR(e, guildId);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
1;
