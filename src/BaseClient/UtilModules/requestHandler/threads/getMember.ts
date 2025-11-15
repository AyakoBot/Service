import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Get the thread member object for a given thread and user ID.
 * @param guildId - The guild ID where the thread is located.
 * @param threadId - The ID of the thread channel.
 * @param userId - The ID of the user to get the thread member object for.
 * @returns A promise that resolves to the thread member object for the given user ID.
 */
export default async (guildId: string, threadId: string, userId: string) =>
 (await getAPI(guildId)).threads
  .getMember(threadId, userId)
  .then((m) => {
   cache.threadMembers.set(m, threadId);
   return cache.threadMembers.apiToR(m, threadId);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
