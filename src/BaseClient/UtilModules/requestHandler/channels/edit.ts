import type { DiscordAPIError } from '@discordjs/rest';
import {
 ChannelType,
 PermissionFlagsBits,
 type RESTPatchAPIChannelJSONBody,
 type APIGuildChannel,
 type APIThreadChannel,
} from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';
import type { RChannelTypes } from '@ayako/gateway/src/BaseClient/Bot/CacheClasses/channel.js';

/**
 * Edits a guild-based channel or thread channel.
 * @param channel - The channel to edit.
 * @param body - The new channel data.
 * @returns A promise that resolves with the updated channel, or rejects with a DiscordAPIError.
 */
export default async (channel: RChannel | RThread, body: RESTPatchAPIChannelJSONBody) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 const isThread = [
  ChannelType.PrivateThread,
  ChannelType.PublicThread,
  ChannelType.AnnouncementThread,
 ].includes(channel.type);

 if (
  !(await canEdit(
   channel.guild_id,
   channel.id,
   body,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
   isThread,
  ))
 ) {
  const e = requestHandlerError(`Cannot edit channel ${channel.id}`, [
   isThread ? PermissionFlagsBits.ManageThreads : PermissionFlagsBits.ManageChannels,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .edit(channel.id, body)
  .then((c) =>
   isThread
    ? cache.threads.apiToR(c as APIThreadChannel)
    : cache.channels.apiToR(c as APIGuildChannel<RChannelTypes>),
  )
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if the user has permission to edit a channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the guild-based channel to be edited.
 * @param body - The JSON body containing the channel edits.
 * @param userId - The user ID.
 * @param isThread - Whether the channel is a thread.
 * @returns A boolean indicating whether the user can edit the channel.
 */
export const canEdit = async (
 guildId: string,
 channelId: string,
 body: RESTPatchAPIChannelJSONBody,
 userId: string,
 isThread: boolean,
) => {
 const hasBasicPermission = await checkChannelPermissions(
  guildId,
  channelId,
  [isThread ? 'ManageThreads' : 'ManageChannels'],
  userId,
 );

 if (!hasBasicPermission) return false;

 if (body.permission_overwrites) {
  const hasManageRoles = await checkChannelPermissions(guildId, channelId, ['ManageRoles'], userId);

  if (!hasManageRoles) return false;
 }

 return true;
};
