import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildRolePositionsJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Sets the positions of a guild's roles.
 * @param guildId The guild ID to set the role positions for.
 * @param body The JSON body containing the new role positions.
 * @param reason The reason for setting the role positions (optional).
 * @returns A promise that resolves with an array of Role objects representing the updated roles,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 body: RESTPatchAPIGuildRolePositionsJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canSetRolePositions(guildId, body, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot set role positions`, [
   PermissionFlagsBits.ManageRoles,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .setRolePositions(guildId, body, { reason })
  .then((roles) => roles.map((r) => cache.roles.apiToR(r, guildId)))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
/**
 * Checks if the user has the necessary permissions to set role positions.
 * @param guildId - The guild ID.
 * @param body - The JSON body containing the new role positions.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can set role positions.
 */
export const canSetRolePositions = async (
 guildId: string,
 body: RESTPatchAPIGuildRolePositionsJSONBody,
 userId: string,
) => {
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

 const userHighestRolePosition = Number(roles.find((r) => r.id === userHighestRole)?.position);

 return body.every((r) => {
  const role = roles.find((role) => role.id === r.id);
  if (!role) return false;
  return role.position < userHighestRolePosition && Number(r.position) < userHighestRolePosition;
 });
};
