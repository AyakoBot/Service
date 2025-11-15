import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPostAPIGuildEmojiJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { resolveImage } from '../../util.js';

/**
 * Creates a new emoji for the specified guild.
 * @param guildId The guild ID to create the emoji in.
 * @param body The emoji data to create.
 * @param reason The reason for creating the emoji.
 * @returns A promise that resolves with the created GuildEmoji object,
 *  or rejects with a DiscordAPIError.
 */
export default async (guildId: string, body: RESTPostAPIGuildEmojiJSONBody, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canCreateEmoji(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot create emoji`, [
   PermissionFlagsBits.ManageGuildExpressions,
  ]);

  error(guildId, e);
  return e;
 }

 const resolvedImage = await resolveImage(body.image);

 return (await getAPI(guildId)).guilds
  .createEmoji(
   guildId,
   {
    ...body,
    image: resolvedImage as string,
   },
   { reason },
  )
  .then((e) => cache.emojis.apiToR(e, guildId))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to create an emoji.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has the permission to create an emoji, false otherwise.
 */
export const canCreateEmoji = async (guildId: string, userId: string) => {
 const hasCreate = await checkPermissions(guildId, ['CreateGuildExpressions'], userId);
 if (hasCreate) return true;

 const hasManage = await checkPermissions(guildId, ['ManageGuildExpressions'], userId);
 return hasManage;
};
