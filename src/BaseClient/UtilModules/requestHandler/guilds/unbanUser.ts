import * as Discord from 'discord.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Unbans a user from the specified guild.
 * @param guild - The guild to unban the user from.
 * @param userId - The ID of the user to unban.
 * @param reason - The reason for unbanning the user (optional).
 * @returns A promise that resolves with the DiscordAPIError if an error occurs, otherwise void.
 */
export default async (guild: RGuild, userId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canUnbanUser(await getBotMemberFromGuild(guild))) {
  const e = requestHandlerError(`Cannot unban user ${userId}`, [
   PermissionFlagsBits.BanMembers,
  ]);

  error(guild, new Error((e as DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).guilds
  .unbanUser(guild.id, userId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
};

/**
 * Checks if the user has the necessary permissions to unban a user.
 * @param me - The Discord guild member representing the user.
 * @returns A boolean indicating whether the user can unban a user.
 */
export const canUnbanUser = (me: RMember) =>
 me.permissions.has(PermissionFlagsBits.BanMembers);
