import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildWidgetSettingsJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Edits the widget settings for a guild.
 * @param guildId The guild ID to edit the widget settings for.
 * @param body The new widget settings to apply.
 * @param reason The reason for editing the widget settings.
 * @returns A promise that resolves to an object containing the new widget settings.
 */
export default async (
 guildId: string,
 body: RESTPatchAPIGuildWidgetSettingsJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEditWidgetSettings(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit widget settings`, [
   PermissionFlagsBits.ManageGuild,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .editWidgetSettings(guildId, body, { reason })
  .then((w) => ({ enabled: w.enabled, channelId: w.channel_id }))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has permission to edit the widget settings for a guild.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has permission to edit the widget settings for a guild,
 * false otherwise.
 */
export const canEditWidgetSettings = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageGuild'], userId);
