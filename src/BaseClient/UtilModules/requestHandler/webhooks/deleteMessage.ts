import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a message sent through a webhook.
 * @param guildId - The guild ID where the webhook is located.
 * @param webhookId - The ID of the webhook.
 * @param token - The token of the webhook.
 * @param messageId - The ID of the message to delete.
 * @param query - Optional query parameters.
 * @returns A promise that resolves with the deleted message or rejects with an error.
 */
export default async (
 guildId: string,
 webhookId: string,
 token: string,
 messageId: string,
 query?: { thread_id: string },
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (await getAPI(guildId)).webhooks
  .deleteMessage(webhookId, token, messageId, query)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
