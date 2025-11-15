import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPostAPIWebhookWithTokenGitHubQuery } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Executes a GitHub webhook for a guild.
 * @param guildId - The guild ID where the webhook is being executed.
 * @param webhookId - The ID of the webhook being executed.
 * @param token - The token for the webhook being executed.
 * @param body - The body of the webhook being executed.
 * @param query - Optional query parameters for the webhook being executed.
 * @returns A Promise that resolves with the result of the webhook execution,
 * or rejects with an error.
 */
export default async (
 guildId: string,
 webhookId: string,
 token: string,
 body: unknown,
 query?: RESTPostAPIWebhookWithTokenGitHubQuery,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (await getAPI(guildId)).webhooks
  .executeGitHub(webhookId, token, body, query)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
