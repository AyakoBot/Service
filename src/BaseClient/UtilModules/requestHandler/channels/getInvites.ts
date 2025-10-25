import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Retrieves the invites for a given guild-based channel.
 * @param channel - The guild-based channel to retrieve invites for.
 * @returns A promise that resolves with an array of parsed invite objects.
 */
export default async (channel: RChannel) => {
 if (
  !(await canGetInvites(
   channel.guild_id,
   channel.id,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot get invites in ${channel.id}`, [
   PermissionFlagsBits.ManageChannels,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .getInvites(channel.id)
  .then((invites) => {
   invites.forEach((i) => cache.invites.set(i));
   return invites.map((i) => cache.invites.apiToR(i));
  })
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if the user has permission to get invites in a guild-based channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the guild-based channel to check permissions in.
 * @param userId - The user ID.
 * @returns A boolean indicating whether the user has permission to get invites.
 */
export const canGetInvites = (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageChannels'], userId);
