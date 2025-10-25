import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Unpins a message from a channel.
 * @param msg The message to unpin.
 * @returns A promise that resolves with the unpinned message, or rejects with an error.
 */
export default async (msg: RMessage) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canUnPinMessage(
   msg.guild_id,
   msg.channel_id,
   (await getBotMemberFromGuild(msg.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot unpin message in ${msg.channel_id}`, [
   PermissionFlagsBits.ManageMessages,
  ]);

  error(msg.guild_id, e);
  return e;
 }

 return (await getAPI(msg.guild_id)).channels
  .unpinMessage(msg.channel_id, msg.id)
  .catch((e: DiscordAPIError) => {
   error(msg.guild_id, e);
   return e;
  });
};

/**
 * Checks if the user has the permission to unpin messages in a guild text-based channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the guild text-based channel to check.
 * @param userId - The user ID.
 * @returns A boolean indicating whether the user can pin messages in the channel.
 */
export const canUnPinMessage = (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageMessages'], userId);
