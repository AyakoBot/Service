import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Removes a member from a thread in a guild.
 * @param guildId - The guild ID where the thread is located.
 * @param threadId - The ID of the thread to remove the member from.
 * @param userId - The ID of the user to remove from the thread.
 * @returns A promise that resolves with the removed member's ID if successful,
 * or rejects with a DiscordAPIError if unsuccessful.
 */
export default async (guildId: string, threadId: string, userId: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canRemoveMember(guildId, threadId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot remove member ${userId} from thread ${threadId}`, [
   PermissionFlagsBits.ManageThreads,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).threads
  .removeMember(threadId, userId)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the user has the permission to remove members from threads.
 * @param guildId - The guild ID where the thread is located.
 * @param threadId - The ID of the thread.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can remove members from threads.
 */
export const canRemoveMember = async (guildId: string, threadId: string, userId: string) => {
 const thread = await cache.threads.get(threadId);
 if (!thread || thread.thread_metadata?.archived) return false;

 const member = await cache.members.get(guildId, userId);
 if (!member) return false;

 return (
  (await checkChannelPermissions(guildId, threadId, ['ManageThreads'], userId)) ||
  member.user_id === thread.owner_id
 );
};
