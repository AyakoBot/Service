import * as Discord from 'discord.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Returns the guilds for the current user.
 * @param guild The guild object.
 * @param query Optional query parameters for the API request.
 * @returns A promise that resolves with the guilds for the current user,
 * or rejects with a DiscordAPIError.
 */
async function fn(
 guild: undefined | null | RGuild,
 query?: Discord.RESTGetAPICurrentUserGuildsQuery,
): Promise<Discord.RESTGetAPICurrentUserGuildsResult | DiscordAPIError> {
 return (await getAPI(guild)).users.getGuilds(query).catch((e: DiscordAPIError) => {
  error(guild, new Error((e as DiscordAPIError).message));
  return e;
 });
}

export default fn;
