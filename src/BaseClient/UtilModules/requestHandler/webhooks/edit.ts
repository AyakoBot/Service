import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIWebhookJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import checkPermissions from '../../checkPermissions.js';
import error from '../../error.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { resolveImage } from '../../util.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Edits a webhook.
 * @param guildId - The guild ID where the webhook is located.
 * @param webhookId - The ID of the webhook to edit.
 * @param channelId - The ID of the channel where the webhook is located.
 * @param webhookToken - Optional webhook token.
 * @param body - The new webhook data to set.
 * @param data - Optional additional data for the request.
 * @returns A promise that resolves with the edited webhook.
 */
export default async (
 guildId: string,
 webhookId: string,
 channelId: string,
 webhookToken: string | undefined,
 body: RESTPatchAPIWebhookJSONBody,
 data?: { token?: string; reason?: string },
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canEdit(guildId, channelId, webhookToken, (await getBotMemberFromGuild(guildId)).user_id))
 ) {
  const e = requestHandlerError(`Cannot edit webhook ${webhookId}`, [
   PermissionFlagsBits.ManageWebhooks,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).webhooks
  .edit(
   webhookId,
   {
    ...body,
    avatar: body.avatar ? await resolveImage(body.avatar) : body.avatar,
   },
   { ...data, token: webhookToken ?? data?.token },
  )
  .then((w) => cache.webhooks.apiToR(w))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the user has the permission to edit webhooks.
 * @param guildId - The guild ID where the webhook is located.
 * @param channelId - The ID of the channel where the webhook is located.
 * @param webhookToken - The webhook token (if missing, requires permissions).
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can edit webhooks.
 */
export const canEdit = async (
 guildId: string,
 channelId: string,
 webhookToken: string | undefined,
 userId: string,
) =>
 !webhookToken
  ? true
  : (await checkPermissions(guildId, ['ManageWebhooks'], userId)) ||
    (await checkChannelPermissions(guildId, channelId, ['ManageWebhooks'], userId));
