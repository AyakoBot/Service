import * as Discord from 'discord.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Returns the current connections of the users in the specified guild.
 * If the connections cannot be retrieved, logs an error and returns the error object.
 * @param guild - The guild to retrieve the connections for.
 * @returns A promise that resolves to an array of user connections or an error object.
 */
export default async (
 guild: RGuild,
): Promise<Discord.RESTGetAPICurrentUserConnectionsResult | DiscordAPIError> =>
 (await getAPI(guild)).users.getConnections().catch((e: DiscordAPIError) => {
  error(guild, new Error((e as DiscordAPIError).message));
  return e;
 });
