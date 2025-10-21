import type { DiscordAPIError } from '@discordjs/rest';
import { api } from '../../../Client.js';
import cache from '../../cache.js';
import error from '../../error.js';

/**
 * Edits the current Application.
 * @param guildId The Guild Id to get the Application from or undefined.
 * @param body The data to send in the request.
 * @returns A Promise that resolves with a DiscordAPIError
 * if the application cannot be found or edited.
 */
export default async (
 guildId: string | undefined,
 body: Parameters<typeof api.applications.editCurrent>[0],
) =>
 (guildId ? (cache.apis.get(guildId) ?? api) : api).applications
  .editCurrent(body)
  .catch((e: DiscordAPIError) => {
   if (guildId) error(guildId, e);
   return e;
  });
