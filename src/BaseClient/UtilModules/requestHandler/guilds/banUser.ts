import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPutAPIGuildBanJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Bans a user from a guild.
 * @param guildId The guild ID to ban the user from.
 * @param userId The ID of the user to ban.
 * @param body Optional request body to send.
 * @param reason Reason for banning the user.
 * @returns A promise that resolves with the DiscordAPIError if the request fails, otherwise void.
 */
export default async (
 guildId: string,
 userId: string,
 body?: RESTPutAPIGuildBanJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canBanUser(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot ban user ${userId}`, [PermissionFlagsBits.BanMembers]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .banUser(guildId, userId, body, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to ban members.
 * @param guildId - The guild ID to check.
 * @param userId - The user ID to check.
 * @returns True if the guild member has the permission to ban members, false otherwise.
 */
export const canBanUser = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['BanMembers'], userId);
