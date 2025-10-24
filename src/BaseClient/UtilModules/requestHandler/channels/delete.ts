import { ChannelType, PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../../BaseClient/Client.js';
import error from '../../error.js';

import type { DiscordAPIError } from '@discordjs/rest';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Deletes a channel from the given guild.
 * @param channel - The channel to delete.
 * @returns A promise that resolves with the deleted channel, or rejects with a DiscordAPIError.
 */
export default async (channel: RChannel) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canDelete(channel, (await getBotMemberFromGuild(channel.guild_id)).user_id)) {
  const e = requestHandlerError(`Cannot delete channel ${channel.name} / ${channel.id}`, [
   [ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.AnnouncementThread].includes(
    channel.type,
   )
    ? PermissionFlagsBits.ManageThreads
    : PermissionFlagsBits.ManageChannels,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .delete(channel.id)
  .then((c) => cache.channels.apiToR(c))
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Determines if a user can delete a specific channel based on channel type and user permissions.
 *
 * For thread channels (private, public, or announcement threads), checks if the user has
 * 'ManageThreads' permission. For all other channel types, checks if the user has
 * 'ManageChannels' permission.
 *
 * @param channel - The channel object to check deletion permissions for
 * @param userId - The ID of the user attempting to delete the channel
 * @returns A promise or boolean indicating whether the user can delete the channel
 */
export const canDelete = (channel: RChannel, userId: string) =>
 [ChannelType.PrivateThread, ChannelType.PublicThread, ChannelType.AnnouncementThread].includes(
  channel.type,
 )
  ? checkChannelPermissions(channel.guild_id, channel.id, ['ManageThreads'], userId)
  : checkChannelPermissions(channel.guild_id, channel.id, ['ManageChannels'], userId);
