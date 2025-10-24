import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import resolvePartialEmoji from '../../resolvePartialEmoji.js';
import { getAPI } from './addReaction.js';

/**
 * Deletes all reactions of a specific emoji from a message.
 * @param msg The message object from which to delete the reactions.
 * @param emoji The emoji to delete reactions for.
 * @returns A promise that resolves with a DiscordAPIError if the operation fails,
 * or void if it succeeds.
 */
export default async (msg: RMessage, emoji: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !canDeleteAllReactionsOfEmoji(
   msg.guild_id,
   msg.channel_id,
   (await getBotMemberFromGuild(msg.guild_id)).user_id,
  )
 ) {
  const e = requestHandlerError(
   `Cannot delete all reactions of emoji ${emoji} in ${msg.guild_id}`,
   [PermissionFlagsBits.ManageMessages],
  );

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
  .deleteAllMessageReactionsForEmoji(
   msg.channel_id,
   msg.id,
   resolvedEmoji.id
    ? `${resolvedEmoji.animated ? 'a:' : ''}${resolvedEmoji.name}:${resolvedEmoji.id}`
    : (resolvedEmoji.name as string),
  )
  .catch((e: DiscordAPIError) => {
   error(msg.guild_id, e);
   return e;
  });
};

/**
 * Checks if the bot has permission to delete all reactions of a specific emoji from messages in a channel.
 *
 * @param guildId - The ID of the guild containing the channel
 * @param channelId - The ID of the channel where reactions would be deleted
 * @param userId - The ID of the user
 * @returns A boolean indicating whether the bot has the required permissions to delete all reactions of an emoji
 *
 * @remarks
 * This function requires the `ManageMessages` permission to delete all reactions of a specific emoji.
 * The permission check is performed against the specified guild and channel context.
 */
export const canDeleteAllReactionsOfEmoji = (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageMessages'], userId);
