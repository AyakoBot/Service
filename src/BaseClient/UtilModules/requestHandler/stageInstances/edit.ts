import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import type { RESTPatchAPIStageInstanceJSONBody } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Edits a stage instance in a stage channel.
 * @param guildId - The guild ID where the stage instance is located.
 * @param channelId - The ID of the stage channel where the stage instance is located.
 * @param body - The new properties for the stage instance.
 * @param reason - The reason for editing the stage instance.
 * @returns A promise that resolves with the updated stage instance
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 channelId: string,
 body: RESTPatchAPIStageInstanceJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEdit(guildId, channelId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit stage instance`, [PermissionFlagsBits.ManageChannels]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).stageInstances
  .edit(channelId, body, { reason })
  .then((s) => cache.stages.apiToR(s))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the user has the permission to edit stage instances.
 * @param guildId - The guild ID where the stage instance is located.
 * @param channelId - The ID of the stage channel where the stage instance is located.
 * @param userId - The user ID performing the action.
 * @returns A boolean indicating whether the user can edit stage instances.
 */
export const canEdit = async (guildId: string, channelId: string, userId: string) =>
 checkChannelPermissions(guildId, channelId, ['ManageChannels'], userId);
