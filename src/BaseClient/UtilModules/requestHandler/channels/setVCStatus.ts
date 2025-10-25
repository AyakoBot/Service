import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Sets the channel status of a voice channel.
 * @param channel - The guild voice channel to show the status in.
 * @param status - The status to show in the voice channel.
 * @returns A promise that resolves when the status is successfully set,
 * or rejects with an error.
 */
export default async (channel: RChannel, status: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canSetVCStatus(
   channel.guild_id,
   channel.id,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot set VC status in ${channel.id}`, [
   PermissionFlagsBits.ManageChannels,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).rest
  .put(`/channels/${channel.id}/voice-status`, { body: { status } })
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  })
  .then((e) => ('message' in (e as Error) ? (e as Error) : true));
};

/**
 * Checks if the user has the permission to set the VC Status in a guild voice channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the guild voice channel to check.
 * @param userId - The user ID.
 * @returns A boolean indicating whether the user can set vc status in the channel.
 */
export const canSetVCStatus = async (guildId: string, channelId: string, userId: string) => {
 const voiceStates = await cache.voices.getAll(guildId);
 const isInVoiceChannel = voiceStates.some(
  (vs) => vs.channel_id === channelId && vs.user_id === userId,
 );

 // SetVoiceChannelStatus permission (281474976710656n) or ManageChannels
 if (isInVoiceChannel) {
  // Has SetVoiceChannelStatus permission while in channel
  return true;
 }

 return checkChannelPermissions(guildId, channelId, ['ManageChannels'], userId);
};
