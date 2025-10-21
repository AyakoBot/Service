import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Gets the current Application.
 * @param guildId The Guild Id to get the Application from.
 * @returns A Promise that resolves with a DiscordAPIError if the application cannot be found.
 */
export default async (guildId?: string) =>
 (await getAPI(guildId)).applications.getCurrent().catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
