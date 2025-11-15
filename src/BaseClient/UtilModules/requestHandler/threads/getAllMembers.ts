import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Retrieves all members of a given thread channel.
 * @param guildId - The guild ID where the thread is located.
 * @param threadId - The ID of the thread channel to retrieve members from.
 * @returns A promise that resolves with an array of ThreadMember objects
 * representing the members of the thread.
 */
export default async (guildId: string, threadId: string) =>
 (await getAPI(guildId)).threads
  .getAllMembers(threadId)
  .then((members) => {
   members.forEach((m) => cache.threadMembers.set(m, threadId));
   return members.map((m) => cache.threadMembers.apiToR(m, threadId));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
