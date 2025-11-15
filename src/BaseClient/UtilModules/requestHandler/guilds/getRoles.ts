import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the roles of a guild from the Discord API
 * and parses them into an array of Role objects.
 * @param guildId - The guild to retrieve the roles from.
 * @returns A Promise that resolves with an array of Role objects.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getRoles(guildId)
  .then((roles) => {
   roles.map((r) => cache.roles.set(r, guildId));
   return roles.map((r) => cache.roles.apiToR(r, guildId));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
