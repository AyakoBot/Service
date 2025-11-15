import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a webhook in a guild.
 * @param guildId - The guild ID where the webhook is located.
 * @param webhookId - The ID of the webhook to delete.
 * @param channelId - The ID of the channel where the webhook is located.
 * @param webhookToken - Optional webhook token.
 * @param data - Optional data to provide when deleting the webhook.
 * @returns A promise that resolves with the deleted webhook if successful,
 * or rejects with a DiscordAPIError if unsuccessful.
 */
export default async (
 guildId: string,
 webhookId: string,
 channelId: string,
 webhookToken?: string,
 data?: { token?: string; reason?: string },
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canDelete(
   guildId,
   channelId,
   webhookToken,
   (await getBotMemberFromGuild(guildId)).user_id,
  ))
 ) {
  const e = requestHandlerError(`Cannot delete webhook ${webhookId}`, [
   PermissionFlagsBits.ManageWebhooks,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).webhooks
  .delete(webhookId, { ...data, token: webhookToken ?? data?.token })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the user has the permission to delete webhooks.
 * @param guildId - The guild ID where the webhook is located.
 * @param channelId - The ID of the channel where the webhook is located.
 * @param webhookToken - The webhook token (if exists, anyone can delete).
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can delete webhooks.
 */
export const canDelete = async (
 guildId: string,
 channelId: string,
 webhookToken: string | undefined,
 userId: string,
) =>
 webhookToken
  ? true
  : (await checkPermissions(guildId, ['ManageWebhooks'], userId)) ||
    (await checkChannelPermissions(guildId, channelId, ['ManageWebhooks'], userId));
