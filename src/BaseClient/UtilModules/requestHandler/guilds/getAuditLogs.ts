import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTGetAPIAuditLogQuery } from 'discord-api-types/v10.js';
import error from '../../error.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the audit logs for a given guild.
 * @param guildId - The ID of the guild to retrieve the audit logs for.
 * @param query - Optional query parameters to filter the audit logs.
 * @returns A promise that resolves to the audit logs data for the guild.
 */
export default async (guildId: string, query?: RESTGetAPIAuditLogQuery) =>
 (await getAPI(guildId)).guilds.getAuditLogs(guildId, query).catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
