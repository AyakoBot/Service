import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a sticker from a guild.
 * @param guildId The guild ID to delete the sticker from.
 * @param stickerId The ID of the sticker to delete.
 * @param reason The reason for deleting the sticker.
 * @returns A promise that resolves with the deleted sticker object if successful,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string, stickerId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canDeleteSticker(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot delete sticker ${stickerId}`, [
   PermissionFlagsBits.ManageGuildExpressions,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .deleteSticker(guildId, stickerId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to delete stickers.
 * @param guildId - The guild ID.
 * @param botId - The bot's user ID.
 * @returns True if the guild member has the permission to delete stickers, false otherwise.
 */
export const canDeleteSticker = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuildExpressions'], userId);
