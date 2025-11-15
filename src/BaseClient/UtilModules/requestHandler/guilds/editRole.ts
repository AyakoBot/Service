import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildRoleJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';
import { resolveImage } from '../../util.js';

/**
 * Edits a role in a guild.
 * @param guildId The guild ID where the role is located.
 * @param roleId The ID of the role to edit.
 * @param body The new data for the role.
 * @param reason The reason for editing the role.
 * @returns A promise that resolves with the edited role or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 roleId: string,
 body: RESTPatchAPIGuildRoleJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEditRole(guildId, roleId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit role ${roleId}`, [PermissionFlagsBits.ManageRoles]);

  error(guildId, e);
  return e;
 }

 const resolvedIcon = body.icon ? await resolveImage(body.icon) : body.icon;

 return (await getAPI(guildId)).guilds
  .editRole(guildId, roleId, { ...body, icon: resolvedIcon }, { reason })
  .then((r) => cache.roles.apiToR(r, guildId))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has permission to edit the specified role.
 * @param guildId - The guild ID.
 * @param roleId - The role ID to be edited.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member can edit the role, false otherwise.
 */
export const canEditRole = async (guildId: string, roleId: string, userId: string) => {
 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;
 if (guild.owner_id === userId) return true;

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

 const roleToEdit = roles.find((r) => r.id === roleId);
 if (!roleToEdit) return false;

 return roleToEdit.position < Number(roles.find((r) => r.id === userHighestRole)?.position);
};
