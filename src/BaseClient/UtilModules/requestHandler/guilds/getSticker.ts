import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves a sticker from the cache or the Discord API.
 * @param guildId The guild where the sticker is located.
 * @param stickerId The ID of the sticker to retrieve.
 * @returns A Promise that resolves with the retrieved sticker, or rejects with an error.
 */
export default async (guildId: string, stickerId: string) =>
 (await getAPI(guildId)).guilds
  .getSticker(guildId, stickerId)
  .then((s) => {
   cache.stickers.set(s);
   return cache.stickers.apiToR(s);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
