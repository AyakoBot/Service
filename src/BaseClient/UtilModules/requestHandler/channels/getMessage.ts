import type { DiscordAPIError } from '@discordjs/rest';
import { ChannelType, PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Retrieves a message from a guild text-based channel by its ID.
 * @param channel - The guild text-based channel where the message is located.
 * @param msgId - The ID of the message to retrieve.
 * @returns A Promise that resolves with the retrieved message or rejects with an error.
 */
export default async (channel: RChannel, msgId: string) => {
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
  const e = requestHandlerError(`Cannot get message ${msgId} in ${channel.id}`, [
   PermissionFlagsBits.ViewChannel,
   PermissionFlagsBits.ReadMessageHistory,
   ...(isVoiceChannel ? [PermissionFlagsBits.Connect] : []),
  ]);

  error(channel.guild_id, e);
  return e;
 }

 const cached = await cache.messages.get(channel.id, msgId);
 if (cached) return cached;

 return (await getAPI(channel.guild_id)).channels
  .getMessage(channel.id, msgId)
  .then((m) => {
   cache.messages.set(m, channel.guild_id);
   return cache.messages.apiToR(m, channel.guild_id);
  })
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if the user has the necessary permissions to get a message in a channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the channel to check permissions in.
 * @param channelType - The type of the channel.
 * @param userId - The user ID.
 * @returns A boolean indicating whether the user has the necessary permissions.
 */
export const canGetMessage = async (
 guildId: string,
 channelId: string,
 channelType: ChannelType,
 userId: string,
) => {
 const permissions: Array<'ViewChannel' | 'ReadMessageHistory' | 'Connect'> = [
  'ViewChannel',
  'ReadMessageHistory',
 ];

 if ([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channelType)) {
  permissions.push('Connect');
 }

 return checkChannelPermissions(guildId, channelId, permissions, userId);
};
