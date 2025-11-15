import type { DiscordAPIError } from '@discordjs/rest';
import type {
 APIApplicationRoleConnection,
 RESTPutAPICurrentUserApplicationRoleConnectionJSONBody,
} from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Updates the application role connection.
 * @param guildId - The guild ID (may be undefined for global operations).
 * @param applicationId - The ID of the application to update the role connection for.
 * @param body - The JSON body containing the updated role connection information.
 * @returns A promise that resolves with the updated role connection information,
 * or rejects with an error.
 */
export default async (
 guildId: string | undefined,
 applicationId: string,
 body: RESTPutAPICurrentUserApplicationRoleConnectionJSONBody,
): Promise<APIApplicationRoleConnection | DiscordAPIError | Error> => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (await getAPI(guildId)).users
  .updateApplicationRoleConnection(applicationId, body)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
