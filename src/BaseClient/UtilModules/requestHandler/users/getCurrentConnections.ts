import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPICurrentUserConnectionsResult } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Returns the current connections of the user.
 * @param guildId - The guild ID (may be undefined for global operations).
 * @returns A promise that resolves to an array of user connections or an error object.
 */
export default async (
 guildId: string | undefined,
): Promise<RESTGetAPICurrentUserConnectionsResult | DiscordAPIError> =>
 (await getAPI(guildId)).users.getConnections().catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
