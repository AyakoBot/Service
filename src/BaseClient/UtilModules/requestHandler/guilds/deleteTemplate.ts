import * as Discord from 'discord.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a guild template.
 * @param guild - The guild where the template is located.
 * @param templateCode - The code of the template to delete.
 * @returns A promise that resolves with the deleted template,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guild: Discord.Guild, templateCode: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canDeleteTemplate(await getBotMemberFromGuild(guild))) {
  const e = requestHandlerError(`Cannot delete template ${templateCode}`, [
   Discord.PermissionFlagsBits.ManageGuild,
  ]);

  error(guild, new Error((e as Discord.DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).guilds
  .deleteTemplate(guild.id, templateCode)
  .catch((e: Discord.DiscordAPIError) => {
   error(guild, new Error((e as Discord.DiscordAPIError).message));
   return e;
  });
};
export const canDeleteTemplate = (me: RMember) =>
 me.permissions.has(Discord.PermissionFlagsBits.ManageGuild);
