import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Deletes a permission overwrite for a channel in a guild.
 * @param channel - The guild-based channel where the permission overwrite is being deleted.
 * @param overwriteId - The ID of the permission overwrite to delete.
 * @param reason - The reason for deleting the permission overwrite.
 * @returns A promise that resolves with the deleted permission overwrite,
 * or rejects with a DiscordAPIError.
 */
export default async (channel: RChannel, overwriteId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canDeletePermissionOverwrite(
   channel.guild_id,
   channel.id,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot delete permission overwrite in ${channel.id}`, [
   PermissionFlagsBits.ManageRoles,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .deletePermissionOverwrite(channel.id, overwriteId, { reason })
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};
/**
 * Checks if the user has the permission to delete a permission overwrite in a channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the guild-based channel to check.
 * @param userId - The user ID.
 * @returns A boolean indicating whether the user has the permission to
 * delete the permission overwrite.
 */
export const canDeletePermissionOverwrite = (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageRoles'], userId);
