import type { DiscordAPIError } from '@discordjs/rest';
import {
 ChannelType,
 PermissionFlagsBits,
 type RESTGetAPIChannelMessagesQuery,
} from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';
import { canGetMessage } from './getMessage.js';

/**
 * Retrieves messages from a guild text-based channel.
 * @param channel - The guild text-based channel to retrieve messages from.
 * @param query - The query parameters to include in the request.
 * @returns A promise that resolves with an array of parsed messages.
 */
export default async (channel: RChannel, query?: RESTGetAPIChannelMessagesQuery) => {
 const isVoiceChannel = [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(
  channel.type,
 );

 if (
  !(await canGetMessage(
   channel.guild_id,
   channel.id,
   channel.type,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot get messages in ${channel.id}`, [
   PermissionFlagsBits.ViewChannel,
   PermissionFlagsBits.ReadMessageHistory,
   ...(isVoiceChannel ? [PermissionFlagsBits.Connect] : []),
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .getMessages(channel.id, query)
  .then((msgs) => {
   msgs.forEach((m) => cache.messages.set(m, channel.guild_id));
   return msgs.map((m) => cache.messages.apiToR(m, channel.guild_id));
  })
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};
