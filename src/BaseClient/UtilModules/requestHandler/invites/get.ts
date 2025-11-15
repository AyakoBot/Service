import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIInviteQuery } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Retrieves an invite with the given code and optional query parameters.
 * @param guildId - The guild ID to retrieve the invite for (may be undefined for global invites).
 * @param code - The code of the invite to retrieve.
 * @param query - Optional query parameters to include in the request.
 * @returns A Promise that resolves with the retrieved invite, or rejects with an error.
 */
export default async (guildId: string | undefined, code: string, query?: RESTGetAPIInviteQuery) =>
 (await getAPI(guildId)).invites
  .get(code, query)
  .then((i) => {
   cache.invites.set(i);
   return cache.invites.apiToR(i);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
