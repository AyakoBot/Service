import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildVoiceStateCurrentMemberJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Sets the voice state for the given guild.
 * @param guildId - The guild ID for which the voice state is to be set.
 * @param body - Optional JSON body containing the voice state data.
 * @returns A promise that resolves with the updated voice state,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 body?: RESTPatchAPIGuildVoiceStateCurrentMemberJSONBody,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canSetVoiceState(guildId, body, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot set voice state`, [
   PermissionFlagsBits.RequestToSpeak,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .setVoiceState(guildId, body)
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
/**
 * Checks if the user has the necessary permissions to set the voice state.
 * @param guildId - The guild ID.
 * @param body - The voice state body.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can set the voice state.
 */
export const canSetVoiceState = async (
 guildId: string,
 body: RESTPatchAPIGuildVoiceStateCurrentMemberJSONBody | undefined,
 userId: string,
) => {
 if (!body) return true;

 if (!body.channel_id) return true;
 if (body.suppress === undefined || body.suppress) return true;

 return checkChannelPermissions(guildId, body.channel_id, ['RequestToSpeak'], userId);
};
