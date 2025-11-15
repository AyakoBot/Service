import type { DiscordAPIError } from '@discordjs/rest';
import type { APIApplicationRoleConnection } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Returns the application role connection for the given application ID.
 * @param guildId - The guild ID (may be undefined for global operations).
 * @param applicationId - The ID of the application to get the role connection for.
 * @returns A promise that resolves to the application role connection,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string | undefined,
 applicationId: string,
): Promise<APIApplicationRoleConnection | DiscordAPIError> =>
 (await getAPI(guildId)).users
  .getApplicationRoleConnection(applicationId)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
