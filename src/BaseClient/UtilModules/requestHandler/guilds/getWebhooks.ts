import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the webhooks for a given guild.
 * @param guildId The ID of the guild to retrieve the webhooks for.
 * @returns A promise that resolves with an array of Webhook objects.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getWebhooks(guildId)
  .then((webhooks) => {
   webhooks.forEach((w) => cache.webhooks.set(w));
   return webhooks.map((w) => cache.webhooks.apiToR(w));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
