import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIAutoModerationRuleJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Edits an auto-moderation rule for a guild.
 * @param guildId The guild ID to edit the auto-moderation rule for.
 * @param ruleId The ID of the auto-moderation rule to edit.
 * @param body The new data for the auto-moderation rule.
 * @param reason The reason for editing the auto-moderation rule.
 * @returns A promise that resolves with the updated auto-moderation rule,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 ruleId: string,
 body: RESTPatchAPIAutoModerationRuleJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEditAutoModerationRule(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit auto-moderation rule ${ruleId}`, [
   PermissionFlagsBits.ManageGuild,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .editAutoModerationRule(guildId, ruleId, body, { reason })
  .then((r) => cache.automods.apiToR(r))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the necessary permissions to edit an auto-moderation rule.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has the "ManageGuild" permission, false otherwise.
 */
export const canEditAutoModerationRule = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuild'], userId);
