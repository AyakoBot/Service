import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIGuildQuery } from 'discord-api-types/v10.js';
import error from '../../error.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Retrieves a guild from the API using the provided guild ID and query parameters.
 *
 * @param guildId - The ID of the guild to retrieve.
 * @param query - The query parameters for the API request.
 * @returns A Promise that resolves to the retrieved guild object.
 */
export default async (guildId: string, query: RESTGetAPIGuildQuery) => {
 const cachedGuild = await cache.guilds.get(guildId);
 if (query.with_counts !== true && cachedGuild) {
  return cachedGuild;
 }

 if (!(await canGet(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot get guild ${guildId}`, []);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .get(guildId, query)
  .then(async (g) => {
   cache.guilds.set(g);
   const parsed = cache.guilds.apiToR(g);

   if (query.with_counts && cachedGuild) {
    cachedGuild.approximate_member_count = parsed.approximate_member_count;
    cachedGuild.approximate_presence_count = parsed.approximate_presence_count;

    return cachedGuild;
   }

   return parsed;
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has permission to get information about a guild.
 * @param guildId - The ID of the guild.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the guild member has permission to get
 * information about the guild.
 */
export const canGet = async (guildId: string, userId: string) => {
 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;

 const member = await cache.members.get(guildId, userId);
 if (!member) return false;

 return true;
};
