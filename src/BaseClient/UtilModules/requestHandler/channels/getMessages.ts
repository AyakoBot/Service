import * as Discord from 'discord.js';
import * as Classes from '../../../Other/classes.js';
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
export default async (
 channel: RChannel,
 query?: Discord.RESTGetAPIChannelMessagesQuery,
) => {
 if (!canGetMessage(channel, await getBotMemberFromGuild(channel.guild))) {
  const e = requestHandlerError(`Cannot get messages in ${channel.name} / ${channel.id}`, [
   PermissionFlagsBits.ViewChannel,
   PermissionFlagsBits.ReadMessageHistory,
   ...([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)
    ? [PermissionFlagsBits.Connect]
    : []),
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .getMessages(channel.id, query)
  .then((msgs) => {
   const parsed = msgs.map((m) => new Classes.Message(channel.client, m));
   parsed.forEach((p) => {
    if (channel.messages.cache.get(p.id)) return;
    channel.messages.cache.set(p.id, p);
   });
   return parsed;
  })
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};
