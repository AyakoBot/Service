import * as Discord from 'discord.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Returns the application role connection for the given application ID in the specified guild.
 * If the guild has an API cache, it will be used, otherwise the default API will be used.
 * @param guild - The guild to get the application role connection from.
 * @param applicationId - The ID of the application to get the role connection for.
 * @returns A promise that resolves to the application role connection,
 * or rejects with a DiscordAPIError.
 */
async function fn(
 guild: undefined | null | RGuild,
 applicationId: string,
): Promise<Discord.APIApplicationRoleConnection | DiscordAPIError> {
 return (await getAPI(guild)).users
  .getApplicationRoleConnection(applicationId)
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
}

export default fn;
