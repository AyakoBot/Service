import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import checkPermissions from '../../checkPermissions.js';
import error from '../../error.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Syncs a guild template with the given template code.
 * @param guildId The guild ID to sync the template for.
 * @param templateCode The code of the template to sync.
 * @returns A promise that resolves with the synced guild template,
 * or rejects with a DiscordAPIError.
 */
export default async (guildId: string, templateCode: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canSyncTemplate(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot sync template`, [PermissionFlagsBits.ManageGuild]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .syncTemplate(guildId, templateCode)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to create a template.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the guild member can create a template.
 */
export const canSyncTemplate = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuild'], userId);
