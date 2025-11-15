import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPostAPIGuildPruneJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Begins pruning of inactive members in a guild.
 * @param guildId - The guild ID to prune members from.
 * @param body - The JSON body to send with the prune request.
 * @param reason - The reason for beginning the prune.
 * @returns A promise that resolves with the result of the prune request,
 * or rejects with a DiscordAPIError.
 */
export default async (guildId: string, body?: RESTPostAPIGuildPruneJSONBody, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canPrune(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot prune members`, [PermissionFlagsBits.KickMembers]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .beginPrune(guildId, body, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the user has the necessary permissions to prune members from a guild.
 * @param guildId - The guild ID to check.
 * @param userId - The user ID to check.
 * @returns A boolean indicating whether the user can prune members.
 */
export const canPrune = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['KickMembers', 'ManageGuild'], userId);
