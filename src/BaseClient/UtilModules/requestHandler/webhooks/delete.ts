import * as Discord from 'discord.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a webhook in a guild.
 * @param guild - The guild where the webhook is located.
 * @param webhook - The webhook to delete.
 * @param data - Optional data to provide when deleting the webhook.
 * @returns A promise that resolves with the deleted webhook if successful,
 * or rejects with a DiscordAPIError if unsuccessful.
 */
export default async (
 guild: Discord.Guild,
 webhook: RWebhook,
 data?: { token?: string; reason?: string },
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canDelete(await getBotMemberFromGuild(guild), webhook)) {
  const e = requestHandlerError(`Cannot delete webhook ${webhook.id}`, [
   Discord.PermissionFlagsBits.ManageWebhooks,
  ]);

  error(guild, new Error((e as Discord.DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).webhooks
  .delete(webhook.id, { ...data, token: webhook.token ?? data?.token })
  .catch((e: Discord.DiscordAPIError) => {
   error(guild, new Error((e as Discord.DiscordAPIError).message));
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to delete webhooks.
 * @param me - The guild member to check.
 * @param webhook - The webhook to check.
 * @returns A boolean indicating whether the guild member can delete webhooks.
 */
export const canDelete = (me: RMember, webhook: RWebhook) =>
 webhook.token
  ? true
  : me.permissions.has(Discord.PermissionFlagsBits.ManageWebhooks) ||
    me.permissionsIn(webhook.channelId).has(Discord.PermissionFlagsBits.ManageWebhooks);
