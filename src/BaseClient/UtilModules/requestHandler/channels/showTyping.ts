import type { DiscordAPIError } from '@discordjs/rest';
import { ChannelType, PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';
import { canGetMessage } from './getMessage.js';

/**
 * Shows typing indicator in the given guild text-based channel.
 * @param channel - The guild text-based channel to show typing indicator in.
 * @returns A promise that resolves when the typing indicator is successfully shown,
 * or rejects with an error.
 */
export default async (channel: RChannel) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

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
  const e = requestHandlerError(`Cannot show typing indicator in ${channel.id}`, [
   PermissionFlagsBits.ViewChannel,
   PermissionFlagsBits.ReadMessageHistory,
   ...(isVoiceChannel ? [PermissionFlagsBits.Connect] : []),
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .showTyping(channel.id)
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};
