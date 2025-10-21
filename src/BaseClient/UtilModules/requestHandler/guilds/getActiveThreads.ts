import { cache } from '../../../Client.js';
import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import type { APIThreadChannel } from 'discord-api-types/v10.js';

/**
 * Retrieves all active threads in a guild and caches them.
 *
 * @param guildId - The ID of the guild to get active threads from
 * @returns A promise that resolves to an array of parsed thread objects, or a DiscordAPIError if the request fails
 *
 * @remarks
 * This function fetches active threads from the Discord API, caches both the threads and their members
 *
 * @example
 * ```typescript
 * const activeThreads = await getActiveThreads('123456789012345678');
 * console.log(activeThreads); // Array of RThread objects
 * ```
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getActiveThreads(guildId)
  .then((t) => {
   (t.threads as APIThreadChannel[]).forEach((p) =>
    cache.threads.set({ ...p, parent_id: p.parent_id || undefined }),
   );

   t.members.forEach((p) => cache.threadMembers.set(p, guildId));

   const parsed = (t.threads as APIThreadChannel[]).map((p) =>
    cache.threads.apiToR({ ...p, parent_id: p.parent_id || undefined }),
   );

   return parsed.filter((p): p is RThread => !!p);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, new Error((e as DiscordAPIError).message));
   return e;
  });
