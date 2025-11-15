import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Unbans a user from the specified guild.
 * @param guildId - The guild ID to unban the user from.
 * @param userId - The ID of the user to unban.
 * @param reason - The reason for unbanning the user (optional).
 * @returns A promise that resolves with the DiscordAPIError if an error occurs, otherwise void.
 */
export default async (guildId: string, userId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canUnbanUser(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot unban user ${userId}`, [
   PermissionFlagsBits.BanMembers,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .unbanUser(guildId, userId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the user has the necessary permissions to unban a user.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can unban a user.
 */
export const canUnbanUser = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['BanMembers'], userId);
