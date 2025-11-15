import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIGuildMembersQuery } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves members from a guild.
 * @param guildId - The ID of the guild to retrieve members from.
 * @param query - The query parameters for the API request.
 * @returns A promise that resolves with an array of GuildMember objects.
 */
export default async (guildId: string, query?: RESTGetAPIGuildMembersQuery) =>
 (await getAPI(guildId)).guilds
  .getMembers(guildId, query)
  .then((members) => {
   members.forEach((m) => cache.members.set(m, guildId));
   return members.map((m) => cache.members.apiToR(m, guildId));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
