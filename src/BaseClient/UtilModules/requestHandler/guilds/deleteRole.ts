import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a role from a guild.
 * @param guildId - The guild ID where the role will be deleted.
 * @param roleId - The ID of the role to be deleted.
 * @param reason - The reason for deleting the role.
 * @returns A promise that resolves with the deleted role,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string, roleId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canDeleteRole(guildId, roleId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot delete role ${roleId}`, [PermissionFlagsBits.ManageRoles]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .deleteRole(guildId, roleId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the specified guild member has the necessary permissions to delete a role.
 * @param guildId - The guild ID.
 * @param roleId - The role ID to be deleted.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the guild member can delete the role.
 */
export const canDeleteRole = async (guildId: string, roleId: string, userId: string) => {
 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;

 if (guild.owner_id === userId) return true;

 const hasManageRoles = await checkPermissions(guildId, ['ManageRoles'], userId);
 if (!hasManageRoles) return false;

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

 const roleToDelete = roles.find((r) => r.id === roleId);
 if (!roleToDelete) return true;

 return Number(roles.find((r) => r.id === userHighestRole)?.position) > roleToDelete.position;
};
