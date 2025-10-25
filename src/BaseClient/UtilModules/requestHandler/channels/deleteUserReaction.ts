import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import resolvePartialEmoji from '../../resolvePartialEmoji.js';
import { getAPI } from './addReaction.js';

/**
 * Deletes a user's reaction from a message.
 * @param msg The message object from which the reaction is to be deleted.
 * @param userId The ID of the user whose reaction is to be deleted.
 * @param emoji The emoji to be deleted.
 * @returns A promise that resolves with the deleted reaction, or rejects with an error.
 */
export default async (msg: RMessage, userId: string, emoji: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canDeleteUserReaction(
   msg.guild_id,
   msg.channel_id,
   (await getBotMemberFromGuild(msg.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot delete user reaction in ${msg.channel_id}`, [
   PermissionFlagsBits.ManageMessages,
  ]);

  error(msg.guild_id, e);
  return e;
 }

 const resolvedEmoji = resolvePartialEmoji(emoji);
 if (!resolvedEmoji) {
  const e = requestHandlerError(`Invalid Emoji ${emoji}`, []);

  error(msg.guild_id, e);
  return e;
 }

 return (await getAPI(msg.guild_id)).channels
  .deleteUserMessageReaction(
   msg.channel_id,
   msg.id,
   resolvedEmoji.id
    ? `${resolvedEmoji.animated ? 'a:' : ''}${resolvedEmoji.name}:${resolvedEmoji.id}`
    : (resolvedEmoji.name as string),
   userId,
  )
  .catch((e: DiscordAPIError) => {
   error(msg.guild_id, e);
   return e;
  });
};

/**
 * Checks if the user has permission to delete a user's reaction in a channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the channel.
 * @param userId - The user ID.
 * @returns True if the user has permission to manage messages in the channel, false otherwise.
 */
export const canDeleteUserReaction = (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageMessages'], userId);
