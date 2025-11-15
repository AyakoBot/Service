import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the widget settings for a given guild.
 * @param guildId - The ID of the guild to retrieve the widget settings for.
 * @returns A promise that resolves to the widget settings data.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds.getWidgetSettings(guildId).catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
