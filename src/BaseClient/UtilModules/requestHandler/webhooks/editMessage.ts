import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIWebhookWithTokenMessageJSONBody } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';
import { resolveFiles } from './execute.js';

/**
 * Edits a message sent by a webhook.
 * @param guildId - The guild ID where the webhook is located.
 * @param webhookId - The ID of the webhook.
 * @param token - The token of the webhook.
 * @param messageId - The ID of the message to edit.
 * @param body - The new message content and options.
 * @returns A Promise that resolves with the edited message or rejects with an error.
 */
export default async (
 guildId: string,
 webhookId: string,
 token: string,
 messageId: string,
 body: RESTPatchAPIWebhookWithTokenMessageJSONBody & {
  files?: { attachment: unknown; name: string }[];
  thread_id?: string;
 },
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (await getAPI(guildId)).webhooks
  .editMessage(webhookId, token, messageId, {
   ...body,
   files: await resolveFiles(body.files),
  })
  .then((m) => cache.messages.apiToR(m, guildId))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
