import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildWelcomeScreenJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Edits the welcome screen of a guild.
 * @param guildId - The guild ID to edit the welcome screen for.
 * @param body - The new welcome screen data.
 * @param reason - The reason for editing the welcome screen.
 * @returns A promise that resolves with the updated welcome screen,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 body: RESTPatchAPIGuildWelcomeScreenJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEditWelcomeScreen(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit welcome screen`, [PermissionFlagsBits.ManageGuild]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .editWelcomeScreen(guildId, body, { reason })
  .then((w) => cache.welcomeScreens.apiToR(w))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
/**
 * Checks if the given guild member has permission to edit the welcome screen of a guild.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has permission to edit the welcome screen of a guild,
 * false otherwise.
 */
export const canEditWelcomeScreen = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuild'], userId);
