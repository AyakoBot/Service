import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Deletes all reactions from a message in a channel.
 * @param msg The message to delete reactions from.
 * @returns A promise that resolves with the deleted message, or rejects with a DiscordAPIError.
 */
export default async (msg: RMessage) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !canDeleteAllReactions(
   msg.guild_id,
   msg.channel_id,
   (await getBotMemberFromGuild(msg.guild_id)).user_id,
  )
 ) {
  const e = requestHandlerError(`Cannot delete all reactions of messages in ${msg.guild_id}`, [
   PermissionFlagsBits.ManageMessages,
  ]);

  error(msg.guild_id, e);
  return e;
 }

 return (await getAPI(msg.guild_id)).channels
  .deleteAllMessageReactions(msg.channel_id, msg.id)
  .catch((e: DiscordAPIError) => {
   error(msg.guild_id, e);
   return e;
  });
};

/**
 * Checks if a user has permission to delete all reactions from messages in a specific channel.
 *
 * @param guildId - The ID of the guild where the channel is located
 * @param channelId - The ID of the channel to check permissions for
 * @param userId - The ID of the user whose permissions are being checked
 * @returns A boolean or promise indicating whether the user can delete all reactions
 *
 * @remarks
 * This function requires the 'ManageMessages' permission to return true.
 * The ability to delete all reactions is typically restricted to users with message management privileges.
 */
export const canDeleteAllReactions = (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageMessages'], userId);
