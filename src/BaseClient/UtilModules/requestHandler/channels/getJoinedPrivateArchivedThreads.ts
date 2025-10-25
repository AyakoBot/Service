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
 * Retrieves the joined private archived threads for a given channel.
 * @param channel - The channel to retrieve the threads for.
 * @param query - The query parameters for the request.
 * @returns A promise that resolves with an array of parsed thread channels.
 */
export default async (channel: RChannel, query: RESTGetAPIChannelThreadsArchivedQuery) => {
 if (
  !(await canGetjoinedPrivateArchivedThreads(
   channel.guild_id,
   channel.id,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot get joined private archived threads in ${channel.id}`, [
   PermissionFlagsBits.ReadMessageHistory,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .getJoinedPrivateArchivedThreads(channel.id, query)
  .then((res) => {
   res.threads.forEach((t) => cache.threads.set(t as APIThreadChannel));
   res.members.forEach((m) => cache.threadMembers.set(m, channel.guild_id));
   return res.threads.map((t) => cache.threads.apiToR(t as APIThreadChannel));
  })
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if the user has permission to get joined private archived threads.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the guild-based channel to check permissions in.
 * @param userId - The user ID.
 * @returns A boolean indicating whether the user has the required permissions permissions.
 */
export const canGetjoinedPrivateArchivedThreads = (
 guildId: string,
 channelId: string,
 userId: string,
) => checkChannelPermissions(guildId, channelId, ['ReadMessageHistory'], userId);
