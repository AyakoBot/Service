import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Deletes a message from a channel.
 * @param msg The message to be deleted.
 * @returns A promise that resolves with the deleted message, or rejects with a DiscordAPIError.
 */
export default async (msg: RMessage) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canDeleteMessages(
   msg.guild_id,
   msg.channel_id,
   msg.author_id,
   (await getBotMemberFromGuild(msg.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot delete message in ${msg.channel_id}`, [
   PermissionFlagsBits.ManageMessages,
  ]);

  error(msg.guild_id, e);
  return e;
 }

 return (await getAPI(msg.guild_id)).channels
  .deleteMessage(msg.channel_id, msg.id)
  .catch((e: DiscordAPIError) => {
   error(msg.guild_id, e);
   return e;
  });
};

/**
 * Checks if the given message can be deleted by the user.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the channel.
 * @param authorId - The ID of the message author.
 * @param userId - The ID of the user attempting to delete.
 * @returns A boolean indicating whether the user can delete the message.
 */
export const canDeleteMessages = async (
 guildId: string,
 channelId: string,
 authorId: string,
 userId: string,
) => {
 if (authorId === userId) return true;

 return checkChannelPermissions(guildId, channelId, ['ManageMessages'], userId);
};
