import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Retrieves a user from the cache or from the API if not found in cache.
 * @param guildId - The guild ID (may be undefined for global operations).
 * @param userId - The ID of the user to retrieve.
 * @param options - Optional force refresh flag.
 * @returns A Promise that resolves to the user object.
 */
export default async (guildId: string | undefined, userId: string, options?: { force: true }) =>
 (!options?.force ? await cache.users.get(userId) : undefined) ??
 (await getAPI(guildId)).users
  .get(userId)
  .then((u) => {
   cache.users.set(u);
   return cache.users.apiToR(u);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
