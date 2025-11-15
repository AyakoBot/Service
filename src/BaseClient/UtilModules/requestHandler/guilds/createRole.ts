import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPostAPIGuildRoleJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { resolveImage } from '../../util.js';

/**
 * Creates a new role in the specified guild.
 * @param guildId - The guild ID where the role will be created.
 * @param body - The role data to be sent in the request body.
 * @param reason - The reason for creating the role.
 * @returns A promise that resolves with the created role or rejects with a DiscordAPIError.
 */
export default async (guildId: string, body: RESTPostAPIGuildRoleJSONBody, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canCreateRole(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot create role`, [PermissionFlagsBits.ManageRoles]);

  error(guildId, e);
  return e;
 }

 const resolvedIcon = body.icon ? await resolveImage(body.icon) : body.icon;

 return (await getAPI(guildId)).guilds
  .createRole(guildId, { ...body, icon: resolvedIcon }, { reason })
  .then((r) => cache.roles.apiToR(r, guildId))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to create a role.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the guild member can create a role.
 */
export const canCreateRole = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageRoles'], userId);
