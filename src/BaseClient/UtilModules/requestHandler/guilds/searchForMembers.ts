import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIGuildMembersSearchQuery } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Searches for members in a guild based on the provided query.
 * @param guildId - The guild ID to search in.
 * @param query - The query to use for searching.
 * @returns A Promise that resolves to an array of GuildMember objects that match the search query.
 */
export default async (guildId: string, query: RESTGetAPIGuildMembersSearchQuery) =>
 (await getAPI(guildId)).guilds
  .searchForMembers(guildId, query)
  .then((members) => {
   members.forEach((m) => cache.members.set(m, guildId));
   return members.map((m) => cache.members.apiToR(m, guildId));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
