import * as Discord from 'discord.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a role from a guild.
 * @param guild - The guild where the role will be deleted.
 * @param roleId - The ID of the role to be deleted.
 * @param reason - The reason for deleting the role.
 * @returns A promise that resolves with the deleted role,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guild: Discord.Guild, roleId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canDeleteRole(await getBotMemberFromGuild(guild), roleId)) {
  const e = requestHandlerError(`Cannot delete role ${roleId}`, [
   PermissionFlagsBits.ManageRoles,
  ]);

  error(guild, new Error((e as Discord.DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).guilds
  .deleteRole(guild.id, roleId, { reason })
  .catch((e: Discord.DiscordAPIError) => {
   error(guild, new Error((e as Discord.DiscordAPIError).message));
   return e;
  });
};

/**
 * Checks if the specified guild member has the necessary permissions to delete a role.
 * @param me - The guild member performing the action.
 * @param roleId - The role ID to be deleted.
 * @returns A boolean indicating whether the guild member can delete the role.
 */
export const canDeleteRole = (me: RMember, roleId: string) =>
 me.guild.ownerId === me.id ||
 (me.permissions.has(PermissionFlagsBits.ManageRoles) &&
  me.roles.highest.comparePositionTo(roleId) > 0);
