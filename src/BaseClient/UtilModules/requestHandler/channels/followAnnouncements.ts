import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Follows announcements from a specified channel in a guild text-based channel.
 * @param channel - The guild text-based channel to follow announcements in.
 * @param followedChannelId - The ID of the channel to follow announcements from.
 * @returns A Promise that resolves to an object containing the ID of the source channel
 * and the ID of the created webhook,
 * or rejects with a DiscordAPIError.
 */
export default async (channel: RChannel, followedChannelId: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canFollowAnnouncements(
   channel.guild_id,
   channel.id,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot follow announcements in ${channel.id}`, [
   PermissionFlagsBits.ManageWebhooks,
   PermissionFlagsBits.ViewChannel,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .followAnnouncements(followedChannelId, channel.id)
  .then((c) => ({ sourceChannelId: c.channel_id, createdWebhookId: c.webhook_id }))
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if the user has the necessary permissions to follow announcements.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the guild text-based channel to check.
 * @param userId - The user ID.
 * @returns A boolean indicating whether the user can follow announcements in the channel.
 */
export const canFollowAnnouncements = (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageWebhooks', 'ViewChannel'], userId);
