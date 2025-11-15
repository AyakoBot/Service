import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildTemplateJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Edits a guild template.
 * @param guildId The guild ID where the template is located.
 * @param templateCode The code of the template to edit.
 * @param body The new data for the template.
 * @returns A promise that resolves with the edited guild template
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 templateCode: string,
 body: RESTPatchAPIGuildTemplateJSONBody,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEditTemplate(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit template ${templateCode}`, [
   PermissionFlagsBits.ManageGuild,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .editTemplate(guildId, templateCode, body)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has permission to edit templates.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has permission to edit templates, false otherwise.
 */
export const canEditTemplate = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuild'], userId);
