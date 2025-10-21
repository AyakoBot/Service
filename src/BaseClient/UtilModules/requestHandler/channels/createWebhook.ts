import {
 PermissionFlagsBits,
 type RESTPostAPIChannelWebhookJSONBody,
} from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { resolveImage } from '../../util.js';

import type { DiscordAPIError } from '@discordjs/rest';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from './addReaction.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';

/**
 * Creates a webhook for a given guild and channel with the provided data.
 * @param guild - The guild where the webhook will be created.
 * @param channelId - The ID of the channel where the webhook will be created.
 * @param body - The data to be sent in the request body.
 * @returns A promise that resolves with a new Webhook object if successful,
 * or rejects with a DiscordAPIError if unsuccessful.
 */
export default async (
 guildId: string,
 channelId: string,
 body: RESTPostAPIChannelWebhookJSONBody,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canCreateWebhook(guildId, channelId, (await getBotMemberFromGuild(guildId)).user_id))
 ) {
  const e = requestHandlerError(`Cannot create webhook`, [PermissionFlagsBits.ManageWebhooks]);

  error(guildId, new Error((e as DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guildId)).channels
  .createWebhook(channelId, {
   ...body,
   avatar: body.avatar ? await resolveImage(body.avatar) : body.avatar,
  })
  .then((w) => cache.webhooks.apiToR(w))
  .catch((e: DiscordAPIError) => {
   error(guildId, new Error((e as DiscordAPIError).message));
   return e;
  });
};

/**
 * Checks if a webhook can be created in a specific channel.
 *
 * Verifies that the user has the required permissions (ManageWebhooks) for the channel
 * and that the channel hasn't reached the maximum limit of 15 webhooks.
 *
 * @param guildId - The ID of the guild where the channel is located
 * @param channelId - The ID of the channel where the webhook should be created
 * @param userId - The ID of the user attempting to create the webhook
 * @returns A promise that resolves to true if the webhook can be created, false otherwise
 */
export const canCreateWebhook = async (guildId: string, channelId: string, userId: string) =>
 (await checkChannelPermissions(guildId, channelId, ['ManageWebhooks'], userId)) &&
 Number(
  await cache.webhooks
   .getAll(guildId)
   .then((webhooks) => webhooks.filter((w) => w.channel_id === channelId).length),
 ) < 15;
