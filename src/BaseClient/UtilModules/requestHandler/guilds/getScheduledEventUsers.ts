import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIGuildScheduledEventUsersQuery } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the users for a scheduled event in a guild.
 * @param guildId The ID of the guild to retrieve the scheduled event users from.
 * @param eventId The ID of the scheduled event to retrieve the users for.
 * @param query Optional query parameters for the API request.
 * @returns A Promise that resolves with an array of objects containing the user
 * and member objects for each user in the scheduled event.
 */
export default async (
 guildId: string,
 eventId: string,
 query?: RESTGetAPIGuildScheduledEventUsersQuery,
) =>
 (await getAPI(guildId)).guilds
  .getScheduledEventUsers(guildId, eventId, query)
  .then((users) => {
   users.map((u) => {
    cache.users.set(u.user);
    if (u.member) cache.members.set(u.member, guildId);
   });

   return users.map((u) => ({
    user: cache.users.apiToR(u.user),
    member: u.member ? cache.members.apiToR(u.member, guildId) : undefined,
   }));
  })

  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
