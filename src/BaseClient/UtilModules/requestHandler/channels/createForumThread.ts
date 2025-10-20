import * as Discord from 'discord.js';
import * as Classes from '../../../Other/classes.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

interface StartForumThreadOptions extends Discord.RESTPostAPIGuildForumThreadsJSONBody {
 message: Discord.RESTPostAPIGuildForumThreadsJSONBody['message'] & {
  files?: Discord.RawFile[];
 };
}

/**
 * Creates a new forum thread in the specified channel.
 * @param channel - The forum channel where the thread will be created.
 * @param body - The options for the new forum thread.
 * @returns A promise that resolves with the newly created forum thread channel.
 */
export default async (
 channel: Discord.ForumChannel | Discord.MediaChannel,
 body: StartForumThreadOptions,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canCreateForumThread(channel.id, await getBotMemberFromGuild(channel.guild))) {
  const e = requestHandlerError(`Cannot create forum post in ${channel.name} / ${channel.id}`, [
   PermissionFlagsBits.SendMessages,
  ]);

  error(channel.guild, e);
  return e;
 }

 return (await getAPI(channel.guild)).channels
  .createForumThread(channel.id, body)
  .then((t) => Classes.Channel(channel.client, t, channel.guild))
  .catch((e: Discord.DiscordAPIError) => {
   error(channel.guild, e);
   return e;
  });
};

/**
 * Checks if the specified user has permission to create a forum thread in the given channel.
 * @param channelId - The ID of the channel in which the forum thread is to be created.
 * @param me - The guild member representing the user.
 * @returns True if the user has permission to create a forum thread, false otherwise.
 */
export const canCreateForumThread = (channelId: string, me: RMember) =>
 me.permissionsIn(channelId).has(PermissionFlagsBits.SendMessages);
