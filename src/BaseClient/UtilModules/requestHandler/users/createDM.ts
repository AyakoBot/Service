import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Creates a direct message channel between the bot and the specified user.
 * @param guildId - The guild ID (may be undefined for global operations).
 * @param userId - The ID of the user to create the DM with.
 * @returns A promise that resolves with the created DM channel,
 * or rejects with a DiscordAPIError if the DM creation fails.
 */
export default async (guildId: string | undefined, userId: string) =>
 (await getAPI(guildId)).users.createDM(userId).catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
