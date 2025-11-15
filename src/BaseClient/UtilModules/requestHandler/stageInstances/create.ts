import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import type { RESTPostAPIStageInstanceJSONBody } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Creates a new stage instance associated with a stage channel.
 * @param guildId - The guild ID where the stage channel is located.
 * @param body - The JSON body of the API request.
 * @param reason - The reason for creating the stage instance.
 * @returns A promise that resolves with the created stage instance
 * or rejects with a DiscordAPIError.
 */
export default async (guildId: string, body: RESTPostAPIStageInstanceJSONBody, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canCreate(guildId, body.channel_id, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot create stage instance`, [
   PermissionFlagsBits.ManageChannels,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).stageInstances
  .create(body, { reason })
  .then((s) => cache.stages.apiToR(s))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the user has the permission to create a stage instance.
 * @param guildId - The guild ID where the stage instance will be created.
 * @param channelId - The ID of the stage channel to associate the stage instance with.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can create a stage instance.
 */
export const canCreate = async (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageChannels'], userId);
