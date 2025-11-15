import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIWebhookWithTokenMessageQuery } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Retrieves a message from a webhook.
 * @param guildId - The guild ID where the webhook is located.
 * @param webhookId - The ID of the webhook.
 * @param token - The token of the webhook.
 * @param messageId - The ID of the message to retrieve.
 * @param query - Optional query parameters for the request.
 * @returns A Promise that resolves with a Message object or rejects with an error.
 */
export default async (
 guildId: string,
 webhookId: string,
 token: string,
 messageId: string,
 query?: RESTGetAPIWebhookWithTokenMessageQuery,
) =>
 (await getAPI(guildId)).webhooks
  .getMessage(webhookId, token, messageId, query)
  .then((m) => {
   cache.messages.set(m, guildId);
   return cache.messages.apiToR(m, guildId);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
