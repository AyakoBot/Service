import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Fetches the emojis of a guild and adds them to the guild's cache.
 * If the guild's emojis are already in the cache, it returns them from the cache.
 * @param guildId - The guild to fetch the emojis for.
 * @returns A promise that resolves with an array of GuildEmoji objects.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getEmojis(guildId)
  .then((emojis) => {
   emojis.map((e) => cache.emojis.set(e, guildId));
   return emojis.map((e) => cache.emojis.apiToR(e, guildId));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
