import type { DiscordAPIError } from '@discordjs/rest';
import {
 PermissionFlagsBits,
 type APIThreadChannel,
 type RESTGetAPIChannelThreadsArchivedQuery,
} from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Retrieves a list of archived threads in a channel.
 * @param channel - The channel to retrieve archived threads from.
 * @param status - The status of the threads to retrieve. Can be either 'private' or 'public'.
 * @param query - The query parameters to include in the request.
 * @returns A Promise that resolves with an array of parsed thread objects.
 */
export default async (
 channel: RChannel,
 status: 'private' | 'public',
 query: RESTGetAPIChannelThreadsArchivedQuery,
) => {
 if (
  !(await canGetArchivedThreads(
   channel.guild_id,
   channel.id,
   status,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(
   `Cannot get archived threads in ${channel.id}`,
   status === 'private'
    ? [PermissionFlagsBits.ManageThreads, PermissionFlagsBits.ReadMessageHistory]
    : [],
  );

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .getArchivedThreads(channel.id, status, query)
  .then((res) => {
   res.threads.forEach((t) => cache.threads.set(t as APIThreadChannel));
   res.members.forEach((m) => cache.threadMembers.set(m, channel.guild_id));
   res.threads.map((t) => cache.threads.apiToR(t as APIThreadChannel));
  })
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Determines whether the current user can get archived threads in a channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the channel in which the archived threads are being accessed.
 * @param status - The status of the archived threads ('private' or 'public').
 * @param userId - The user ID.
 * @returns A boolean value indicating whether the current user can get archived threads.
 */
export const canGetArchivedThreads = async (
 guildId: string,
 channelId: string,
 status: 'private' | 'public',
 userId: string,
) =>
 status === 'private'
  ? checkChannelPermissions(guildId, channelId, ['ManageThreads', 'ReadMessageHistory'], userId)
  : true;
