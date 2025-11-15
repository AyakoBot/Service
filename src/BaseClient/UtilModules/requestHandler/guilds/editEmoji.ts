import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildEmojiJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Edits a guild emoji.
 * @param guildId The guild ID where the emoji is located.
 * @param emojiId The ID of the emoji to edit.
 * @param body The new data for the emoji.
 * @param reason The reason for editing the emoji.
 * @returns A promise that resolves with the edited guild emoji, or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 emojiId: string,
 body: RESTPatchAPIGuildEmojiJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEditEmoji(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit emoji ${emojiId}`, [
   PermissionFlagsBits.ManageGuildExpressions,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .editEmoji(guildId, emojiId, body, { reason })
  .then((e) => cache.emojis.apiToR(e, guildId))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has permission to edit emojis.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has permission to edit emojis, false otherwise.
 */
export const canEditEmoji = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuildExpressions'], userId);
