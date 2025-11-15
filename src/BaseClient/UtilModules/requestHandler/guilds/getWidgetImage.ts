import type { DiscordAPIError } from '@discordjs/rest';
import type { GuildWidgetStyle } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Get the widget image of a guild with the specified style.
 * @param guildId - The ID of the guild to get the widget image for.
 * @param style - The style of the widget image.
 * @returns A Promise that resolves with the widget image, or rejects with a DiscordAPIError.
 */
export default async (guildId: string, style?: GuildWidgetStyle) =>
 (await getAPI(guildId)).guilds.getWidgetImage(guildId, style).catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
