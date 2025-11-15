import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIGuildBansQuery } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves a list of bans for the specified guild.
 * @param guildId - The ID of the guild to retrieve the bans for.
 * @param query - An optional query to filter the results.
 * @returns A promise that resolves with an array of GuildBan objects.
 */
export default async (guildId: string, query?: RESTGetAPIGuildBansQuery) =>
 (await getAPI(guildId)).guilds
  .getMemberBans(guildId, query)
  .then((bans) => {
   bans.forEach((ban) => cache.bans.set(ban, guildId));
   return bans.map((ban) => cache.bans.apiToR(ban, guildId));
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
