import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Creates a new sticker for the given guild.
 * @param guildId The guild ID to create the sticker in.
 * @param body The sticker data to send in the request.
 * @param reason The reason for creating the sticker.
 * @returns A promise that resolves with the created sticker, or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 body: Parameters<Awaited<ReturnType<typeof getAPI>>['guilds']['createSticker']>[1],
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canCreateSticker(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot create sticker`, [
   PermissionFlagsBits.ManageGuildExpressions,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .createSticker(guildId, body, { reason })
  .then((s) => cache.stickers.apiToR(s))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to create an sticker.
 * @param guildId - The guild ID.
 * @param botId - The bot's user ID.
 * @returns True if the guild member has the permission to create an sticker, false otherwise.
 */
export const canCreateSticker = async (guildId: string, userId: string) => {
 const hasCreate = await checkPermissions(guildId, ['CreateGuildExpressions'], userId);
 if (hasCreate) return true;

 const hasManage = await checkPermissions(guildId, ['ManageGuildExpressions'], userId);
 return hasManage;
};
