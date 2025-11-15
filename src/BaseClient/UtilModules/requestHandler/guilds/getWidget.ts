import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the widget for a given guild.
 * @param guildId - The ID of the guild to retrieve the widget for.
 * @returns A promise that resolves with the widget data if successful,
 * or rejects with a DiscordAPIError if unsuccessful.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds.getWidget(guildId).catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
