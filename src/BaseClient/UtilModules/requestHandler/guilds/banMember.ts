import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPutAPIGuildBanJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { canBanUser } from './banUser.js';

/**
 * Bans a user from a guild.
 * @param guildId The guild ID where the member is.
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

 const botMember = await getBotMemberFromGuild(guildId);
 if (!(await canBanMember(guildId, userId, botMember.user_id))) {
  const e = requestHandlerError(`Cannot ban member ${userId}`, [PermissionFlagsBits.BanMembers]);

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
 * Checks if the given guild member has the permission to ban another member.
 * @param guildId - The guild ID to check.
 * @param targetUserId - The ID of the user to ban.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has the permission to ban another member, false otherwise.
 */
export const canBanMember = async (guildId: string, targetUserId: string, userId: string) => {
 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;
 if (guild.owner_id === userId) return true;

 if (!(await canBanUser(guildId, userId))) return false;

 const member = await cache.members.get(guildId, userId);
 if (!member) return false;

 const targetMember = await cache.members.get(guildId, targetUserId);
 if (!targetMember) return true;

 const roles = await cache.roles.getAll(guildId);
 const userHighestRole = member.roles
  .sort(
   (a, b) => roles.find((r) => r.id === b)?.position! - roles.find((r) => r.id === a)?.position!,
  )
  .shift();
 const targetHighestRole = targetMember.roles
  .sort(
   (a, b) => roles.find((r) => r.id === b)?.position! - roles.find((r) => r.id === a)?.position!,
  )
  .shift();

 if (!userHighestRole) return false;
 if (!targetHighestRole) return true;

 return (
  Number(roles.find((r) => r.id === targetHighestRole)?.position) <
  Number(roles.find((r) => r.id === userHighestRole)?.position)
 );
};
