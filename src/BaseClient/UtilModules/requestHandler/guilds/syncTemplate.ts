import * as Discord from 'discord.js';
import * as Classes from '../../../Other/classes.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Syncs a guild template with the given template code.
 * @param guild The guild to sync the template for.
 * @param templateCode The code of the template to sync.
 * @returns A promise that resolves with the synced guild template,
 * or rejects with a DiscordAPIError.
 */
export default async (guild: Discord.Guild, templateCode: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canSyncTemplate(await getBotMemberFromGuild(guild))) {
  const e = requestHandlerError(`Cannot sync template`, [PermissionFlagsBits.ManageGuild]);

  error(guild, new Error((e as Discord.DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).guilds
  .syncTemplate(guild.id, templateCode)
  .then((t) => new Classes.GuildTemplate(guild.client, t))
  .catch((e: Discord.DiscordAPIError) => {
   error(guild, new Error((e as Discord.DiscordAPIError).message));
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to create a template.
 * @param me - The Discord guild member.
 * @returns A boolean indicating whether the guild member can create a template.
 */
export const canSyncTemplate = (me: RMember) =>
 me.permissions.has(PermissionFlagsBits.ManageGuild);
