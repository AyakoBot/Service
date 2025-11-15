import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildStickerJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Edits a sticker in a guild.
 * @param guildId The guild ID where the sticker is located.
 * @param stickerId The ID of the sticker to edit.
 * @param body The new data for the sticker.
 * @param reason The reason for editing the sticker.
 * @returns A promise that resolves with the edited sticker, or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 stickerId: string,
 body: RESTPatchAPIGuildStickerJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEditSticker(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit sticker ${stickerId}`, [
   PermissionFlagsBits.ManageGuildExpressions,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .editSticker(guildId, stickerId, body, { reason })
  .then((s) => cache.stickers.apiToR(s))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has permission to edit stickers.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has permission to edit stickers, false otherwise.
 */
export const canEditSticker = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuildExpressions'], userId);
