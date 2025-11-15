import type { DiscordAPIError } from '@discordjs/rest';
import type { APIGuildMember } from 'discord-api-types/v10.js';
import { getAPI } from '../channels/addReaction.js';
import { api, cache } from '../../../Client.js';

/**
 * Retrieves a member from a guild by their user ID.
 * @param guildId The guild ID to retrieve the member from
 * @param userId The ID of the user to retrieve.
 * @param forceMainAPI - Whether to force using the main API instead of custom API.
 * @returns A Promise that resolves with the GuildMember object,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (
 guildId: string,
 userId: string,
 forceMainAPI: boolean = false,
): Promise<any | DiscordAPIError | Error> => {
 if (!guildId) return new Error('guildId is not defined');

 const cachedMember = await cache.members.get(guildId, userId);
 if (cachedMember) return cachedMember;

 return (forceMainAPI ? api : await getAPI(guildId)).guilds
  .getMember(guildId, userId)
  .then((m) => {
   cache.members.set(m as APIGuildMember, guildId);
   return cache.members.apiToR(m as APIGuildMember, guildId);
  })
  .catch((e: DiscordAPIError) => e as DiscordAPIError);
};
