import * as Discord from 'discord.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Updates the application role connection for the given guild.
 * @param guild - The guild to update the application role connection for.
 * @param applicationId - The ID of the application to update the role connection for.
 * @param body - The JSON body containing the updated role connection information.
 * @returns A promise that resolves with the updated role connection information,
 * or rejects with an error.
 */
async function fn(
 guild: undefined | null | RGuild,
 applicationId: string,
 body: Discord.RESTPutAPICurrentUserApplicationRoleConnectionJSONBody,
): Promise<Discord.APIApplicationRoleConnection | DiscordAPIError | Error> {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (await getAPI(guild)).users
  .updateApplicationRoleConnection(applicationId, body)
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
}

export default fn;
