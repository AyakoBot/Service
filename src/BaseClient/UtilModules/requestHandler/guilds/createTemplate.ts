import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPostAPIGuildTemplatesJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Creates a new template for the specified guild.
 * @param guildId The guild ID to create the template for.
 * @param body The template data to create the template with.
 * @returns A promise that resolves with the created guild template,
 * or rejects with a DiscordAPIError.
 */
export default async (guildId: string, body: RESTPostAPIGuildTemplatesJSONBody) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canCreateTemplate(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot create template`, [PermissionFlagsBits.ManageGuild]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds.createTemplate(guildId, body).catch((e: DiscordAPIError) => {
  error(guildId, e);
  return e;
 });
};
/**
 * Checks if the given guild member has the permission to create a template.
 * @param guildId - The guild ID.
 * @param botId - The bot's user ID.
 * @returns A boolean indicating whether the guild member can create a template.
 */
export const canCreateTemplate = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuild'], userId);
