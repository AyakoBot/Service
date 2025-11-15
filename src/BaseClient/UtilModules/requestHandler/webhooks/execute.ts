import type { DiscordAPIError } from '@discordjs/rest';
import type {
 RESTPostAPIWebhookWithTokenJSONBody,
 RESTPostAPIWebhookWithTokenQuery,
} from 'discord-api-types/v10.js';
import error from '../../error.js';
import { resolveFile } from '../../util.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

type Body = Omit<
 RESTPostAPIWebhookWithTokenJSONBody & RESTPostAPIWebhookWithTokenQuery,
 'files'
> & { files?: { attachment: unknown; name?: string }[] };

/**
 * Executes a webhook with the given parameters
 * and returns a Promise that resolves with a new Message object.
 * @param guildId - The guild ID where the webhook is executed (may be undefined).
 * @param webhookId - The ID of the webhook to execute.
 * @param token - The token of the webhook to execute.
 * @param body - The body of the webhook to execute.
 * @returns A Promise that resolves with a new Message object.
 */
export default async (
 guildId: string | undefined,
 webhookId: string,
 token: string,
 body: Body,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 return (await getAPI(guildId)).webhooks
  .execute(webhookId, token, {
   ...body,
   files: await resolveFiles(body.files),
   wait: true,
  })
  .then((m) => cache.messages.apiToR(m, guildId || '@me'))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

export const resolveFiles = async (files: { attachment: unknown; name?: string }[] | undefined) =>
 files
  ? (await Promise.all(files.map((f) => resolveFile(f.attachment)))).map((f, i) => ({
     ...f,
     name: files[i].name ?? String(Date.now() + i),
    }))
  : undefined;
