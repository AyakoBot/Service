import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildChannelPositionsJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Sets the positions of a batch of channels for a guild.
 * @param guildId - The guild ID to set the channel positions for.
 * @param body - The JSON body containing the new positions of the channels.
 * @param reason - The reason for setting the channel positions (optional).
 * @returns A promise that resolves with the updated guild channel positions,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 body: RESTPatchAPIGuildChannelPositionsJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canSetChannelPositions(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot set channel positions`, [
   PermissionFlagsBits.ManageChannels,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .setChannelPositions(guildId, body, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the user has the necessary permissions to set channel positions.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can set channel positions.
 */
export const canSetChannelPositions = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageChannels'], userId);
