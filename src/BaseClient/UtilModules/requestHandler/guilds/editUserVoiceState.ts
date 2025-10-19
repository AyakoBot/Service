import * as Discord from 'discord.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Edits the voice state of a user in a guild.
 * @param guild The guild where the user's voice state will be edited.
 * @param userId The ID of the user whose voice state will be edited.
 * @param body The new voice state data for the user.
 * @param reason The reason for editing the user's voice state.
 * @returns A promise that resolves with the updated voice state of the user,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guild: Discord.Guild,
 userId: string,
 body: Discord.RESTPatchAPIGuildVoiceStateUserJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canEditUserVoiceState(await getBotMemberFromGuild(guild), body)) {
  const e = requestHandlerError(`Cannot edit user voice state`, [
   Discord.PermissionFlagsBits.MuteMembers,
  ]);

  error(guild, new Error((e as Discord.DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).guilds
  .editUserVoiceState(guild.id, userId, body, { reason })
  .catch((e: Discord.DiscordAPIError) => {
   error(guild, new Error((e as Discord.DiscordAPIError).message));
   return e;
  });
};
/**
 * Checks if the given guild member has permission to edit the voice state of a user.
 * @param me - The guild member to check.
 * @param member - The guild member whose voice state will be edited.
 * @param body - The edited Voice State.
 * @returns True if the guild member has permission to edit the voice state of a user,
 * false otherwise.
 */

export const canEditUserVoiceState = (
 me: RMember,
 body: Discord.RESTPatchAPIGuildVoiceStateUserJSONBody,
) => me.permissionsIn(body.channel_id).has(Discord.PermissionFlagsBits.MuteMembers);
