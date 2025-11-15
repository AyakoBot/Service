import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Removes a role from a member in a guild.
 * @param guildId - The guild ID where the member is in.
 * @param userId - The ID of the member to remove the role from.
 * @param roleId - The ID of the role to remove from the member.
 * @param reason - The reason for removing the role (optional).
 * @returns A promise that resolves with the removed role or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 userId: string,
 roleId: string,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canRemoveRoleFromMember(guildId, roleId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot remove role ${roleId}`, [
   PermissionFlagsBits.ManageRoles,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .removeRoleFromMember(guildId, userId, roleId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to remove roles.
 * @param guildId - The guild ID.
 * @param roleId - The role ID to remove.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has the permission to remove roles, false otherwise.
 */
export const canRemoveRoleFromMember = async (guildId: string, roleId: string, userId: string) => {
 if (!(await checkPermissions(guildId, ['ManageRoles'], userId))) return false;

 const member = await cache.members.get(guildId, userId);
 if (!member) return false;
 if (!member.roles.length) return false;

 const roles = await cache.roles.getAll(guildId);
 const userHighestRole = member.roles
  .sort(
   (a, b) => roles.find((r) => r.id === b)?.position! - roles.find((r) => r.id === a)?.position!,
  )
  .shift();

 if (!userHighestRole) return false;

 const roleToRemove = roles.find((r) => r.id === roleId);
 if (!roleToRemove) return false;

 return roleToRemove.position < Number(roles.find((r) => r.id === userHighestRole)?.position);
};
