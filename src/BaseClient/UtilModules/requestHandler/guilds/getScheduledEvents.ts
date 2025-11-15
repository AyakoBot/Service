import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves scheduled events for a given guild.
 * @param guildId - The ID of the guild to retrieve scheduled events for.
 * @returns A promise that resolves with an array of parsed scheduled events.
 */
export default async (guildId: string) =>
 (await getAPI(guildId)).guilds
  .getScheduledEvents(guildId)
  .then((events) => {
   events.map((e) => cache.events.set(e));
   return events.map((e) => cache.events.apiToR(e));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
