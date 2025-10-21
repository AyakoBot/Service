import * as Discord from 'discord.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Sets the voice state for the given guild.
 * @param guild - The guild for which the voice state is to be set.
 * @param body - Optional JSON body containing the voice state data.
 * @returns A promise that resolves with the updated voice state,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guild: RGuild,
 body?: Discord.RESTPatchAPIGuildVoiceStateCurrentMemberJSONBody,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canSetVoiceState(await getBotMemberFromGuild(guild), body)) {
  const e = requestHandlerError(`Cannot set voice state`, [
   PermissionFlagsBits.RequestToSpeak,
  ]);

  error(guild, new Error((e as DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).guilds
  .setVoiceState(guild.id, body)
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
};
/**
 * Checks if the user has the necessary permissions to set the voice state.
 * @param me - The Discord guild member representing the user.
 * @returns A boolean indicating whether the user can set the voice state.
 */
export const canSetVoiceState = (
 me: RMember,
 body?: Discord.RESTPatchAPIGuildVoiceStateCurrentMemberJSONBody,
) => {
 if (!body) return true;

 if (!body.channel_id) return true;
 if (!body.suppress) {
  return me.permissionsIn(body.channel_id).has(PermissionFlagsBits.RequestToSpeak);
 }
 return true;
};
