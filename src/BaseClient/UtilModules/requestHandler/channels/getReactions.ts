import type { DiscordAPIError } from '@discordjs/rest';
import {
 ChannelType,
 PermissionFlagsBits,
 type RESTGetAPIChannelMessageReactionUsersQuery,
} from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import resolvePartialEmoji from '../../resolvePartialEmoji.js';
import { getAPI } from './addReaction.js';
import { canGetMessage } from './getMessage.js';

/**
 * Retrieves a list of users who reacted with a specific emoji to a message.
 * @param msg The message to retrieve reactions from.
 * @param emoji The emoji to retrieve reactions for.
 * @param query Optional query parameters to filter the results.
 * @returns A promise that resolves with an array of users who reacted with the specified emoji.
 */
export default async (
 msg: RMessage,
 emoji: string,
 query?: RESTGetAPIChannelMessageReactionUsersQuery,
) => {
 const channel = await cache.channels.get(msg.channel_id);
 const isVoiceChannel =
  channel && [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type);

 if (
  channel &&
  !(await canGetMessage(
   msg.guild_id,
   msg.channel_id,
   channel.type,
   (await getBotMemberFromGuild(msg.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot get reactions of emoji ${emoji} in ${msg.channel_id}`, [
   PermissionFlagsBits.ViewChannel,
   PermissionFlagsBits.ReadMessageHistory,
   ...(isVoiceChannel ? [PermissionFlagsBits.Connect] : []),
  ]);

  error(msg.guild_id, e);
  return e;
 }

 const resolvedEmoji = resolvePartialEmoji(emoji);
 if (!resolvedEmoji) {
  const e = requestHandlerError(`Invalid Emoji ${emoji}`, []);

  error(msg.guild_id, e);
  return e;
 }

 return (await getAPI(msg.guild_id)).channels
  .getMessageReactions(
   msg.channel_id,
   msg.id,
   resolvedEmoji.id
    ? `${resolvedEmoji.animated ? 'a:' : ''}${resolvedEmoji.name}:${resolvedEmoji.id}`
    : (resolvedEmoji.name as string),
   query,
  )
  .then((users) => {
   users.forEach((u) => cache.users.set(u));
   return users.map((u) => cache.users.apiToR(u));
  })
  .catch((e: DiscordAPIError) => {
   error(msg.guild_id, e);
   return e;
  });
};
