import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Returns a promise that resolves with an array of integrations for the given guild.
 * If an error occurs, logs the error and returns the error object.
 * @param guildId - The ID of the guild to get integrations for.
 * @returns A promise that resolves with an array of integrations for the given guild.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getIntegrations(guildId)
  .then((integrations) => {
   integrations.map((i) => cache.integrations.set(i, guildId));
   return integrations.map((i) => cache.integrations.apiToR(i, guildId));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
