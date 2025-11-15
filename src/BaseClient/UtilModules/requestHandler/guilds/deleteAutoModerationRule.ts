import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes an auto-moderation rule from a guild.
 * @param guildId - The guild ID to delete the auto-moderation rule from.
 * @param ruleId - The ID of the auto-moderation rule to delete.
 * @param reason - The reason for deleting the auto-moderation rule.
 * @returns A promise that resolves with the deleted auto-moderation rule,
 * or rejects with an error.
 */
export default async (guildId: string, ruleId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canDeleteAutoModerationRule(guildId, (await getBotMemberFromGuild(guildId)).user_id))
 ) {
  const e = requestHandlerError(`Cannot delete auto-moderation rule ${ruleId}`, [
   PermissionFlagsBits.ManageGuild,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .deleteAutoModerationRule(guildId, ruleId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};
/**
 * Checks if the given Discord GuildMember has the permission to delete an auto-moderation rule.
 * @param guildId - The guild ID.
 * @param botId - The bot's user ID.
 * @returns A boolean indicating whether the GuildMember has the required permission.
 */
export const canDeleteAutoModerationRule = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuild'], userId);
