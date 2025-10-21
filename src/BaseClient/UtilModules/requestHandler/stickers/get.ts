import * as Discord from 'discord.js';
import * as Classes from '../../../Other/classes.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves a sticker from the cache or API.
 * @param guild The guild where the sticker is located.
 * @param stickerId The ID of the sticker to retrieve.
 * @returns A promise that resolves with the retrieved sticker, or rejects with an error.
 */
export default async <T extends RGuild | null>(
 guild: T,
 stickerId: string,
 client: T extends null ? Discord.Client<true> : undefined,
) =>
 guild?.stickers.cache.get(stickerId) ??
 (await getAPI(guild)).stickers
  .get(stickerId)
  .then((s) => {
   const parsed = new Classes.Sticker((guild?.client ?? client)!, s);
   if (guild?.stickers.cache.get(parsed.id)) return parsed;
   guild?.stickers.cache.set(parsed.id, parsed);
   return parsed;
  })
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
