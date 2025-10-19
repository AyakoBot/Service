import * as Discord from 'discord.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Begins pruning of inactive members in a guild.
 * @param guild - The guild to prune members from.
 * @param body - The JSON body to send with the prune request.
 * @param reason - The reason for beginning the prune.
 * @returns A promise that resolves with the result of the prune request,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guild: Discord.Guild,
 body?: Discord.RESTPostAPIGuildPruneJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canPrune(await getBotMemberFromGuild(guild))) {
  const e = requestHandlerError(`Cannot prune members`, [Discord.PermissionFlagsBits.KickMembers]);

  error(guild, new Error((e as Discord.DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).guilds
  .beginPrune(guild.id, body, { reason })
  .catch((e: Discord.DiscordAPIError) => {
   error(guild, new Error((e as Discord.DiscordAPIError).message));
   return e;
  });
};
/**
 * Checks if the user has the necessary permissions to prune members from a guild.
 * @param me - The Discord guild member representing the user.
 * @returns A boolean indicating whether the user can prune members.
 */
export const canPrune = (me: RMember) =>
 me.permissions.has(Discord.PermissionFlagsBits.KickMembers);
