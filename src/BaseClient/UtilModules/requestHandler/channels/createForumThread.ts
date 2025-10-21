import type { DiscordAPIError, RawFile } from '@discordjs/rest';
import {
 PermissionFlagsBits,
 type RESTPostAPIGuildForumThreadsJSONBody,
} from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

interface StartForumThreadOptions extends RESTPostAPIGuildForumThreadsJSONBody {
 message: RESTPostAPIGuildForumThreadsJSONBody['message'] & {
  files?: RawFile[];
 };
}

/**
 * Creates a new forum thread in the specified channel.
 * @param channel - The forum channel where the thread will be created.
 * @param body - The options for the new forum thread.
 * @returns A promise that resolves with the newly created forum thread channel.
 */
export default async (channel: RChannel, body: StartForumThreadOptions) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canCreateForumThread(
   channel.guild_id,
   channel.id,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot create forum post in ${channel.name} / ${channel.id}`, [
   PermissionFlagsBits.SendMessages,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .createForumThread(channel.id, body)
  .then((t) => cache.threads.apiToR({ ...t, parent_id: t.parent_id || undefined }))
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if the specified user has permission to create a forum thread in the given channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the channel in which the forum thread is to be created.
 * @param userId - The user.
 * @returns True if the user has permission to create a forum thread, false otherwise.
 */
export const canCreateForumThread = (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['SendMessages'], userId);
