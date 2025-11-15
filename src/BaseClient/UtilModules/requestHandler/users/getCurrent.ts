import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Returns the current user.
 * @param guildId - The guild ID (may be undefined for global operations).
 * @returns A promise that resolves with the current user
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string | undefined) =>
 (await getAPI(guildId)).users
  .getCurrent()
  .then((u) => {
   cache.users.set(u);
   return cache.users.apiToR(u);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
