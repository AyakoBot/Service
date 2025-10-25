import type { DiscordAPIError } from '@discordjs/rest';
import {
 PermissionFlagsBits,
 type RESTPutAPIChannelPermissionJSONBody,
} from 'discord-api-types/v10.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Edits a permission overwrite for a guild-based channel.
 * @param channel - The guild-based channel to edit the permission overwrite for.
 * @param overwriteId - The ID of the permission overwrite to edit.
 * @param body - The new permission overwrite data.
 * @param reason - The reason for editing the permission overwrite.
 * @returns A promise that resolves with the updated permission overwrite,
 * or rejects with a DiscordAPIError.
 */
export default async (
 channel: RChannel,
 overwriteId: string,
 body: RESTPutAPIChannelPermissionJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canEditPermissionOverwrite(
   channel.guild_id,
   channel.id,
   body,
   overwriteId,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot edit permission overwrite in ${channel.id}`, [
   PermissionFlagsBits.ManageRoles,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .editPermissionOverwrite(channel.id, overwriteId, body, { reason })
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if the user can edit a permission overwrite in a guild-based channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the guild-based channel.
 * @param body - The JSON body of the REST API request to edit the permission overwrite.
 * @param overwriteId - The ID of the permission overwrite.
 * @param userId - The user ID.
 * @returns A boolean indicating whether the user can edit the permission overwrite.
 */
export const canEditPermissionOverwrite = async (
 guildId: string,
 channelId: string,
 body: RESTPutAPIChannelPermissionJSONBody,
 overwriteId: string,
 userId: string,
) => {
 const hasManageRoles = await checkChannelPermissions(guildId, channelId, ['ManageRoles'], userId);

 if (!hasManageRoles) return false;

 // If editing own permissions, check if user has the allow permissions
 if (overwriteId === userId && body.allow) {
  // Additional permission validation could be added here if needed
  return true;
 }

 return true;
};
