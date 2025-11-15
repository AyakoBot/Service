import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the invites for a given guild.
 * @param guildId The ID of the guild to retrieve invites for.
 * @returns A promise that resolves with an array of parsed invite objects.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getInvites(guildId)
  .then((invites) => {
   invites.forEach((i) => cache.invites.set(i));
   return invites.map((i) => cache.invites.apiToR(i));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
