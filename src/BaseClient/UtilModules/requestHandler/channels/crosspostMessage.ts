import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { cache } from '../../../Client.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';
import type { DiscordAPIError } from '@discordjs/rest';
import checkChannelPermissions from '../../checkChannelPermissions.js';

/**
 * Crossposts a message to all following channels.
 * @param msg - The message to crosspost.
 * @returns A promise that resolves with the new message object if successful,
 * or rejects with an error.
 */
export default async (msg: RMessage) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 const me = await getBotMemberFromGuild(msg.guild_id);

 if (!canCrosspostMessages(msg, me.user_id)) {
  const e = requestHandlerError(`Cannot crosspost message in ${msg.guild_id}`, [
   PermissionFlagsBits.SendMessages,
   ...(msg.author_id === me.user_id ? [PermissionFlagsBits.ManageMessages] : []),
  ]);

  error(msg.guild_id, e);
  return e;
 }

 return (await getAPI(msg.guild_id)).channels
  .crosspostMessage(msg.channel_id, msg.id)
  .then((m) => cache.messages.apiToR(m, msg.guild_id || '@me'))
  .catch((e: DiscordAPIError) => {
   error(msg.guild_id, e);
   return e;
  });
};

/**
 * Checks if a user can crosspost a message in a channel.
 *
 * @param message - The message to check crosspost permissions for
 * @param userId - The ID of the user attempting to crosspost the message
 * @returns A promise that resolves to true if the user can crosspost the message, false otherwise
 */
export const canCrosspostMessages = async (message: RMessage, userId: string) =>
 (await checkChannelPermissions(message.guild_id, message.channel_id, ['SendMessages'], userId)) &&
 (message.author_id === userId
  ? true
  : await checkChannelPermissions(
     message.guild_id,
     message.channel_id,
     ['ManageMessages'],
     userId,
    ));
