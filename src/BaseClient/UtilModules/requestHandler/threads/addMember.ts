import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error, { sendDebugMessage } from '../../error.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Adds a member to a thread in a guild.
 * @param guildId - The guild ID where the thread is located.
 * @param threadId - The ID of the thread to add the member to.
 * @param userId - The ID of the user to add to the thread.
 * @returns A promise that resolves with the added member or rejects with a DiscordAPIError.
 */
export default async (guildId: string, threadId: string, userId: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canAddMember(guildId, threadId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot add member ${userId} to thread ${threadId}`, [
   PermissionFlagsBits.SendMessages,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).threads.addMember(threadId, userId).catch((e: DiscordAPIError) => {
  if (e.message.includes('Missing Access')) {
   const e2 = requestHandlerError(
    `Cannot add User ${userId} to thread ${threadId} because they are not a member`,
    [PermissionFlagsBits.SendMessages],
   );

   error(guildId, e2);
   return e;
  }

  if (e.message.includes('Missing Permissions')) {
   sendDebugMessage({ content: JSON.stringify(e) });
   return e;
  }

  error(guildId, e);
  return e;
 });
};
/**
 * Checks if the user has the permission to add members to threads.
 * @param guildId - The guild ID where the thread is located.
 * @param threadId - The ID of the thread.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can add members to threads.
 */
export const canAddMember = async (guildId: string, threadId: string, userId: string) => {
 const thread = await cache.threads.get(threadId);
 if (!thread || thread.thread_metadata?.archive_timestamp) return false;

 return checkChannelPermissions(guildId, threadId, ['SendMessages'], userId);
};
