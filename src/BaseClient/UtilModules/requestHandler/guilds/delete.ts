import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes the specified guild.
 * @param guildId The guild ID to delete.
 * @returns A promise that resolves with the deleted guild ID if successful,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canDelete(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot delete guild ${guildId}`, [
   PermissionFlagsBits.ManageGuild,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds.delete(guildId).catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
};

/**
 * Checks if the specified guild member has the permission to delete the guild.
 * @param guildId - The guild ID.
 * @param userId - The user ID to check.
 * @returns A boolean indicating whether the guild member can delete the guild.
 */
export const canDelete = async (guildId: string, userId: string) => {
 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;

 return guild.owner_id === userId;
};
