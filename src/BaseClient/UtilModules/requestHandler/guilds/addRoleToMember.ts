import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Adds a role to a member in a guild.
 * @param guildId - The guild ID where the member is in.
 * @param userId - The ID of the member to add the role to.
 * @param roleId - The ID of the role to add to the member.
 * @param reason - The reason for adding the role (optional).
 * @returns A promise that resolves with the updated member object if successful,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string, userId: string, roleId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canAddRoleToMember(guildId, roleId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot add role to member`, [PermissionFlagsBits.ManageRoles]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .addRoleToMember(guildId, userId, roleId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if a role can be added to a guild member.
 * @param guildId - The guild ID where the role is being added.
 * @param roleId - The ID of the role to be added.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the role can be added to the member.
 */
export const canAddRoleToMember = async (guildId: string, roleId: string, userId: string) => {
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

 const roleToAdd = roles.find((r) => r.id === roleId);
 if (!roleToAdd) return false;

 return roleToAdd.position < Number(roles.find((r) => r.id === userHighestRole)?.position);
};
