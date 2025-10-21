import * as Discord from 'discord.js';
import * as Classes from '../../../Other/classes.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the templates for a given guild.
 * @param guild - The guild to retrieve templates for.
 * @returns A promise that resolves with an array of GuildTemplate objects.
 */
export default async (guild: RGuild) => {
 if (!canGetTemplates(await getBotMemberFromGuild(guild))) {
  const e = requestHandlerError(`Cannot get template`, [PermissionFlagsBits.KickMembers]);

  error(guild, new Error((e as DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).guilds
  .getTemplates(guild.id)
  .then((templates) => templates.map((t) => new Classes.GuildTemplate(guild.client, t)))
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to get templates.
 * @param me - The Discord guild member.
 * @returns True if the guild member has the permission to get templates, false otherwise.
 */
export const canGetTemplates = (me: RMember) =>
 me.permissions.has(PermissionFlagsBits.ManageGuild);
