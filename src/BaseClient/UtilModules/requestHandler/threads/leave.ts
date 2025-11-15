import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Leaves a thread in a guild.
 * @param guildId - The guild ID where the thread is located.
 * @param threadId - The ID of the thread to leave.
 * @returns A promise that resolves with the DiscordAPIError if an error occurs, otherwise void.
 */
export default async (guildId: string, threadId: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canLeave(threadId))) {
  const e = requestHandlerError(`Cannot leave thread ${threadId}`, [
   PermissionFlagsBits.SendMessages,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).threads.leave(threadId).catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
};

/**
 * Checks if the bot can leave the thread.
 * @param guildId - The guild ID where the thread is located.
 * @param threadId - The ID of the thread.
 * @returns A boolean indicating whether the bot can leave the thread.
 */
export const canLeave = async (threadId: string) => {
 const thread = await cache.threads.get(threadId);
 return thread && !thread.thread_metadata?.archived;
};
