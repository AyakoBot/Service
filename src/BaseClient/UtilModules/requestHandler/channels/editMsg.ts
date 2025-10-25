import type { DiscordAPIError } from '@discordjs/rest';
import {
 PermissionFlagsBits,
 type RESTPatchAPIChannelMessageJSONBody,
} from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Edits a message in a channel.
 * @param msg - The message to edit.
 * @param payload - The new message content and options.
 * @returns A promise that resolves with the edited message, or rejects with a DiscordAPIError.
 */
export default async (msg: RMessage, payload: RESTPatchAPIChannelMessageJSONBody) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canEditMessage(
   msg.guild_id,
   msg.channel_id,
   msg.author_id,
   payload,
   (await getBotMemberFromGuild(msg.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot edit message in ${msg.channel_id}`, [
   PermissionFlagsBits.ManageMessages,
  ]);

  error(msg.guild_id, e);
  return e;
 }

 return (await getAPI(msg.guild_id)).channels
  .editMessage(msg.channel_id, msg.id, payload)
  .then((m) => cache.messages.apiToR(m, msg.guild_id))
  .catch((e: DiscordAPIError) => {
   (e as DiscordAPIError & { cause?: unknown }).cause = payload;
   error(msg.guild_id, e, true);
   return e;
  });
};

/**
 * Checks if the message can be edited.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the channel.
 * @param authorId - The ID of the message author.
 * @param payload - The payload containing the message edit data.
 * @param userId - The user ID attempting to edit.
 * @returns Returns true if the message can be edited, otherwise false.
 */
export const canEditMessage = async (
 guildId: string,
 channelId: string,
 authorId: string,
 payload: RESTPatchAPIChannelMessageJSONBody,
 userId: string,
) => {
 if (authorId === userId) return true;

 return (
  (await checkChannelPermissions(guildId, channelId, ['ManageMessages'], userId)) && !!payload.flags
 );
};
