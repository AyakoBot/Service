import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes an integration from a guild.
 * @param guildId The guild ID to delete the integration from.
 * @param integrationId The ID of the integration to delete.
 * @param reason The reason for deleting the integration.
 * @returns A promise that resolves with the deleted integration if successful,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string, integrationId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canDeleteIntegration(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot delete integration ${integrationId}`, [
   PermissionFlagsBits.ManageGuild,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .deleteIntegration(guildId, integrationId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to delete integrations.
 * @param guildId - The guild ID.
 * @param botId - The bot's user ID.
 * @returns A boolean indicating whether the guild member can delete integrations.
 */
export const canDeleteIntegration = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuild'], userId);
