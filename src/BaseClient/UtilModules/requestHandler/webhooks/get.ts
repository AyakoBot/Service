import type { DiscordAPIError } from '@discordjs/rest';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Retrieves a webhook from the Discord API and returns it.
 * @param guildId - The guild ID where the webhook is located.
 * @param webhookId - The ID of the webhook to retrieve.
 * @param token - Optional token to use for authentication.
 * @returns A promise that resolves with the webhook object,
 * or rejects with a DiscordAPIError.
 */
export default async (guildId: string, webhookId: string, token?: string) =>
 (await getAPI(guildId)).webhooks
  .get(webhookId, { token })
  .then((w) => {
   cache.webhooks.set(w);
   return cache.webhooks.apiToR(w);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
