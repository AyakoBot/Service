import {
 ChannelType,
 PermissionFlagsBits,
 type RESTPostAPIChannelThreadsJSONBody,
} from 'discord-api-types/v10.js';
import error from '../../error.js';
import { cache } from '../../../Client.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import getActiveThreads from '../guilds/getActiveThreads.js';
import { getAPI } from './addReaction.js';
import type { DiscordAPIError } from '@discordjs/rest';
import checkChannelPermissions from '../../checkChannelPermissions.js';

/**
 * Creates a thread in a guild text-based channel.
 * @param channel - The guild text-based channel where the thread will be created.
 * @param body - The REST API JSON body for creating the thread.
 * @param msgId - The ID of the message to create the thread from.
 * @returns A promise that resolves with the created thread or rejects with a DiscordAPIError.
 */
export default async (
 channel: RChannel,
 body: RESTPostAPIChannelThreadsJSONBody,
 msgId?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canCreateThread(channel, body, (await getBotMemberFromGuild(channel.guild_id)).user_id))
 ) {
  const e = requestHandlerError(
   `Cannot create ${
    body.type === ChannelType.PrivateThread ? 'private' : 'public / announcement'
   } threads in ${channel.name} / ${channel.id}`,
   [
    body.type === ChannelType.PublicThread
     ? PermissionFlagsBits.CreatePublicThreads
     : PermissionFlagsBits.CreatePrivateThreads,
   ],
  );

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .createThread(channel.id, body, msgId)
  .then((t) => cache.threads.apiToR({ ...t, parent_id: t.parent_id || undefined }))
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if a thread can be created in the specified channel.
 * 
 * @param channel - The Discord channel where the thread would be created
 * @param body - The request body containing thread creation parameters
 * @param userId - The ID of the user attempting to create the thread
 * 
 * @returns A promise that resolves to `true` if the thread can be created, `false` otherwise
 * 
 * @remarks
 * This function validates multiple conditions:
 * - Channel type must be one of: GuildAnnouncement, GuildStageVoice, GuildText, or GuildVoice
 * - User must have ViewChannel permission
 * - For public threads: user must have CreatePublicThreads permission
 * - For private threads: user must have CreatePrivateThreads permission and channel cannot be GuildAnnouncement
 * - Channel must have fewer than 800 active threads (safety limit below Discord's 1000 limit)
 */
export const canCreateThread = async (
 channel: RChannel,
 body: RESTPostAPIChannelThreadsJSONBody,
 userId: string,
) =>
 [
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildText,
  ChannelType.GuildVoice,
 ].includes(channel.type) &&
 (await checkChannelPermissions(channel.guild_id, channel.id, ['ViewChannel'], userId)) &&
 (body.type === ChannelType.PublicThread
  ? await checkChannelPermissions(channel.guild_id, channel.id, ['CreatePublicThreads'], userId)
  : (await checkChannelPermissions(
     channel.guild_id,
     channel.id,
     ['CreatePrivateThreads'],
     userId,
    )) && channel.type !== ChannelType.GuildAnnouncement) &&
 Number(
  (await getActiveThreads(channel.guild_id).then((m) => ('message' in m ? undefined : m)))?.filter(
   (t) => t.parent_id === channel.id,
  ).length,
 ) < 800; // should be 1000, but we should be safe
