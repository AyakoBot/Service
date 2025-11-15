import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIGuildPruneCountQuery } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Get the number of members that would be removed in a prune operation.
 * @param guildId - The ID of the guild to get the prune count for.
 * @param query - The query parameters for the prune operation.
 * @returns A promise that resolves with the number of members that
 * would be removed in the prune operation.
 */
export default async (guildId: string, query?: RESTGetAPIGuildPruneCountQuery) =>
 (await getAPI(guildId)).guilds.getPruneCount(guildId, query).catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
