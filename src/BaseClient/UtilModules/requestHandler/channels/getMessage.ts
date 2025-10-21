import * as Discord from 'discord.js';
import * as Classes from '../../../Other/classes.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Retrieves a message from a guild text-based channel by its ID.
 * @param channel - The guild text-based channel where the message is located.
 * @param msgId - The ID of the message to retrieve.
 * @returns A Promise that resolves with the retrieved message or rejects with an error.
 */
export default async (
 channel: Extract<Discord.TextBasedChannel, { messages: Discord.GuildMessageManager }>,
 msgId: string,
) => {
 if (!canGetMessage(channel, await getBotMemberFromGuild(channel.guild))) {
  const e = requestHandlerError(`Cannot get message ${msgId} in ${channel.name} / ${channel.id}`, [
   PermissionFlagsBits.ViewChannel,
   PermissionFlagsBits.ReadMessageHistory,
   ...([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)
    ? [PermissionFlagsBits.Connect]
    : []),
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (
  channel.messages.cache.get(msgId) ??
  (await getAPI(channel.guild_id)).channels
   .getMessage(channel.id, msgId)
   .then((m) => {
    const parsed = new Classes.Message(channel.guild.client, m);
    if (channel.messages.cache.get(parsed.id)) return parsed;
    channel.messages.cache.set(parsed.id, parsed);
    return parsed;
   })
   .catch((e: DiscordAPIError) => e as DiscordAPIError)
 );
};

/**
 * Checks if the user has the necessary permissions to get a message in a channel.
 * @param channel - The channel to check permissions in.
 * @param me - The user's guild member object.
 * @returns A boolean indicating whether the user has the necessary permissions.
 */
export const canGetMessage = (channel: RChannel, me: RMember) =>
 me.permissionsIn(channel).has(PermissionFlagsBits.ViewChannel) &&
 me.permissionsIn(channel).has(PermissionFlagsBits.ReadMessageHistory) &&
 ([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)
  ? me.permissionsIn(channel).has(PermissionFlagsBits.Connect)
  : true);
