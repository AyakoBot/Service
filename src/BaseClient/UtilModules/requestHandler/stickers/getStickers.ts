import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves Nitro sticker packs.
 * @param guildId - The guild ID (may be undefined for global operation).
 * @returns A promise that resolves with the Nitro sticker packs, or rejects with a DiscordAPIError.
 */
export default async (guildId: string | undefined) =>
 (await getAPI(guildId)).stickers.getStickers().catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
