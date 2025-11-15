import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the stickers for a given guild.
 * @param guildId The guild to retrieve the stickers for.
 * @returns A Promise that resolves with an array of parsed Sticker objects.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getStickers(guildId)
  .then((stickers) => {
   stickers.map((s) => cache.stickers.set(s));
   return stickers.map((s) => cache.stickers.apiToR(s));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
