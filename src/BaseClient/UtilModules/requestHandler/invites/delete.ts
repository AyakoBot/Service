import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes an invite for the given guild and code.
 * @param guildId - The guild ID where the invite is created.
 * @param code - The code of the invite to delete.
 * @param channelId - The ID of the channel where the invite was created.
 * @param reason - The reason for deleting the invite.
 * @returns A promise that resolves with the deleted invite or rejects with a DiscordAPIError.
 */
export default async (guildId: string, code: string, channelId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canDeleteInvite(guildId, channelId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot delete invite ${code}`, [
   PermissionFlagsBits.ManageGuild,
   PermissionFlagsBits.ManageChannels,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).invites
  .delete(code, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the bot has the necessary permissions to delete an invite.
 * @param guildId - The guild ID where the invite is located.
 * @param channelId - The ID of the channel where the invite was created.
 * @param userId - The user ID performing the action.
 * @returns True if the user has the necessary permissions, false otherwise.
 */
export const canDeleteInvite = async (guildId: string, channelId: string, userId: string) =>
 (await checkPermissions(guildId, ['ManageGuild'], userId)) ||
 (await checkChannelPermissions(guildId, channelId, ['ManageChannels'], userId));
