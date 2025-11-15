import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildVoiceStateUserJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Edits the voice state of a user in a guild.
 * @param guildId The guild ID where the user's voice state will be edited.
 * @param userId The ID of the user whose voice state will be edited.
 * @param body The new voice state data for the user.
 * @param reason The reason for editing the user's voice state.
 * @returns A promise that resolves with the updated voice state of the user,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 userId: string,
 body: RESTPatchAPIGuildVoiceStateUserJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canEditUserVoiceState(guildId, body, (await getBotMemberFromGuild(guildId)).user_id))
 ) {
  const e = requestHandlerError(`Cannot edit user voice state`, [PermissionFlagsBits.MuteMembers]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .editUserVoiceState(guildId, userId, body, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has permission to edit the voice state of a user.
 * @param guildId - The guild ID.
 * @param body - The edited Voice State.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has permission to edit the voice state of a user,
 * false otherwise.
 */
export const canEditUserVoiceState = (
 guildId: string,
 body: RESTPatchAPIGuildVoiceStateUserJSONBody,
 userId: string,
) => checkChannelPermissions(guildId, body.channel_id, ['MuteMembers'], userId);
