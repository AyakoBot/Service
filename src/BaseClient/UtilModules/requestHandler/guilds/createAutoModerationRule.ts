import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPostAPIAutoModerationRuleJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Creates an auto-moderation rule for a guild.
 * @param guildId The guild ID to create the rule for.
 * @param body The JSON body of the auto-moderation rule.
 * @param reason The reason for creating the rule.
 * @returns A promise that resolves with the created auto-moderation rule.
 */
export default async (
 guildId: string,
 body: RESTPostAPIAutoModerationRuleJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (
  !(await canCreateAutoModerationRule(guildId, (await getBotMemberFromGuild(guildId)).user_id))
 ) {
  const e = requestHandlerError(`Cannot create auto-moderation rule`, [
   PermissionFlagsBits.ManageGuild,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .createAutoModerationRule(guildId, body, { reason })
  .then((r) => cache.automods.apiToR(r))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to create an auto-moderation rule.
 * @param guildId - The guild ID.
 * @param botId - The bot's user ID.
 * @returns A boolean indicating whether the member can create an auto-moderation rule.
 */
export const canCreateAutoModerationRule = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuild'], userId);
