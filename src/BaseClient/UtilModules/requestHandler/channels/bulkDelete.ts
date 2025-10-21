import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';

import { getAPI } from './addReaction.js';
import type { DiscordAPIError } from '@discordjs/rest';
import checkChannelPermissions from '../../checkChannelPermissions.js';

/**
 * Deletes multiple messages in a guild text-based channel.
 * @param channel - The guild text-based channel where the messages are located.
 * @param msgs - An array of message IDs to delete.
 * @returns A promise that resolves with the deleted messages or rejects with a DiscordAPIError.
 */
export default async (channel: RChannel, msgs: string[]) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canBulkDelete(
   channel.guild_id,
   channel.id,
   (await getBotMemberFromGuild(channel.guild_id)).user_id,
   msgs.length,
  ))
 ) {
  const e = requestHandlerError(`Cannot bulk-delete messages in ${channel.id}`, [
   PermissionFlagsBits.ManageMessages,
  ]);

  error(channel.guild_id, e);
  return e;
 }

 return (await getAPI(channel.guild_id)).channels
  .bulkDeleteMessages(channel.id, msgs)
  .catch((e: DiscordAPIError) => {
   error(channel.guild_id, e);
   return e;
  });
};

/**
 * Checks if a bulk-delete can be executed by a given user in a given channel.
 * @param guildId - The ID of the guild to check.
 * @param channelId - The ID of the guild text-based channel to check.
 * @param userId - The user ID.
 * @returns A boolean indicating whether the user has the necessary permissions.
 */
export const canBulkDelete = async (
 guildId: string,
 channelId: string,
 userId: string,
 amount: number,
) =>
 (await checkChannelPermissions(guildId, channelId, ['ManageMessages'], userId)) &&
 amount > 1 &&
 amount < 101;
