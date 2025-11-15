import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a stage instance in a guild's voice channel.
 * @param guildId - The guild ID where the stage instance is located.
 * @param channelId - The ID of the voice channel where the stage instance is located.
 * @param reason - The reason for deleting the stage instance.
 * @returns A promise that resolves with the deleted stage instance,
 * or rejects with a DiscordAPIError.
 */
export default async (guildId: string, channelId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canDelete(guildId, channelId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot delete stage instance`, [
   PermissionFlagsBits.ManageChannels,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).stageInstances
  .delete(channelId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the user has the permission to delete stage instances.
 * @param guildId - The guild ID where the stage instance is located.
 * @param channelId - The ID of the voice channel where the stage instance is located.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can delete stage instances.
 */
export const canDelete = async (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageChannels'], userId);
