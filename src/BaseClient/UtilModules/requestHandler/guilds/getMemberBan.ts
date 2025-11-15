import type { DiscordAPIError } from '@discordjs/rest';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the ban for a given user in a guild.
 * @param guildId - The ID of the guild to retrieve the ban from.
 * @param userId - The ID of the user to retrieve the ban for.
 * @returns A promise that resolves with the GuildBan object for the user,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string, userId: string) =>
 (await getAPI(guildId)).guilds
  .getMemberBan(guildId, userId)
  .then((b) => {
   cache.bans.set(b, guildId);
   return cache.bans.apiToR(b, guildId);
  })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
