import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { cache } from '../../../Client.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';
import {
 PermissionFlagsBits,
 type RESTPostAPIChannelInviteJSONBody,
} from 'discord-api-types/v10.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';

/**
 * Creates an invite for a guild-based channel.
 * @param channel - The guild-based channel to create the invite for.
 * @param body - The invite data to send.
 * @param reason - The reason for creating the invite.
 * @returns A promise that resolves with the created invite or rejects with a DiscordAPIError.
 */
export default async (
 channel: RChannel,
 body: RESTPostAPIChannelInviteJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canCreateInvite(
   channel.guild_id,
   channel.id,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot create invite in ${channel.name} / ${channel.id}`, [
   PermissionFlagsBits.CreateInstantInvite,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .createInvite(channel.id, body, { reason })
  .then((i) => cache.invites.apiToR(i))
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if the given user has permission to create an invite in the specified channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the guild-based channel to check.
 * @param userIde - The user.
 * @returns A boolean indicating whether the user can create an invite in the channel.
 */
export const canCreateInvite = (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['CreateInstantInvite'], userId);
