import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Retrieves a sticker from the cache or API.
 * @param guildId - The guild ID where the sticker is located (undefined for global stickers).
 * @param stickerId - The ID of the sticker to retrieve.
 * @returns A promise that resolves with the retrieved sticker, or rejects with an error.
 */
export default async (guildId: string | undefined, stickerId: string) =>
 (await getAPI(guildId)).stickers
  .get(stickerId)
  .then((s) => {
   cache.stickers.set(s);
   return cache.stickers.apiToR(s);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
