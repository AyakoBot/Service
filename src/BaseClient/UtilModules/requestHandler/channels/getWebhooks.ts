import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';

import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';

/**
 * Retrieves the webhooks for a given guild text-based channel or forum channel.
 * @param channel - The guild text-based channel or forum channel to retrieve webhooks for.
 * @returns A promise that resolves with an array of webhooks for the given channel.
 */
export default async (channel: RChannel) => {
 if (
  !(await canGetWebhooks(
   channel.guild_id,
   channel.id,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot get webhooks in ${channel.id}`, [
   PermissionFlagsBits.ManageWebhooks,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .getWebhooks(channel.id)
  .then((raw) => {
   raw.forEach((w) => cache.webhooks.set(w));
   return raw.map((w) => cache.webhooks.apiToR(w));
  })
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if the user has permission to get webhooks in a given channel.
 * @param guildId - The ID of the guild.
 * @param channelId - The ID of the channel to check permissions in.
 * @param userId - The user ID.
 * @returns A boolean indicating whether the user has permission to manage webhooks in the channel.
 */
export const canGetWebhooks = (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageWebhooks'], userId);
