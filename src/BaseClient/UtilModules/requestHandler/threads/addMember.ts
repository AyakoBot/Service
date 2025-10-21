import * as Discord from 'discord.js';
import error, { sendDebugMessage } from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Adds a member to a thread in a guild.
 * @param thread - The thread to add the member to.
 * @param userId - The ID of the user to add to the thread.
 * @returns A promise that resolves with the added member or rejects with a DiscordAPIError.
 */
export default async (thread: RThread, userId: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canAddMember(await getBotMemberFromGuild(thread.guild), thread)) {
  const e = requestHandlerError(
   `Cannot add member ${userId} to thread ${thread.name} / ${thread.id} in ${thread.guild.name} / ${thread.guild.id}`,
   [PermissionFlagsBits.SendMessages],
  );

  error(thread.guild, e);
  return e;
 }

 return (await getAPI(thread.guild)).threads
  .addMember(thread.id, userId)
  .catch((e: DiscordAPIError) => {
   if (e.message.includes('Missing Access')) {
    const e2 = requestHandlerError(
     `Cannot add User ${userId} to thread ${thread.name} / ${thread.id} because they are not a member`,
     [PermissionFlagsBits.SendMessages],
    );

    error(thread.guild, e2);
    return e;
   }

   if (e.message.includes('Missing Permissions')) {
    sendDebugMessage({ content: JSON.stringify(e) });
    return e;
   }

   error(thread.guild, e);
   return e;
  });
};
/**
 * Checks if the given guild member has the permission to add members to threads.
 * @param me - The guild member to check.
 * @param thread - The thread channel.
 * @returns A boolean indicating whether the guild member can add members to threads.
 */
export const canAddMember = (me: RMember, thread: RThread) =>
 me.permissionsIn(thread.id).has(PermissionFlagsBits.SendMessages) && !thread.archived;
