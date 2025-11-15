import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a guild template.
 * @param guildId - The guild ID where the template is located.
 * @param templateCode - The code of the template to delete.
 * @returns A promise that resolves with the deleted template,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string, templateCode: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canDeleteTemplate(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot delete template ${templateCode}`, [
   PermissionFlagsBits.ManageGuild,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .deleteTemplate(guildId, templateCode)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if a user has permission to delete a guild template.
 *
 * @param guildId - The ID of the guild where the template deletion is being attempted
 * @param userId - The ID of the user attempting to delete the template
 * @returns A boolean or promise indicating whether the user has the required permissions
 */
export const canDeleteTemplate = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuild'], userId);
