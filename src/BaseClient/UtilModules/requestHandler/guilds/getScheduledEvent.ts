import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIGuildScheduledEventQuery } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves a scheduled event from the specified guild.
 * @param guildId - The ID of the guild to retrieve the scheduled event from.
 * @param eventId - The ID of the scheduled event to retrieve.
 * @param query - Optional query parameters to include in the request.
 * @returns A Promise that resolves with the retrieved scheduled event, or rejects with an error.
 */
export default async (
 guildId: string,
 eventId: string,
 query?: RESTGetAPIGuildScheduledEventQuery,
) =>
 (await getAPI(guildId)).guilds
  .getScheduledEvent(guildId, eventId, query)
  .then((e) => {
   cache.events.set(e);
   return cache.events.apiToR(e);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
