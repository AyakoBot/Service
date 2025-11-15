import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a scheduled event for a guild.
 * @param guildId - The guild ID where the event is scheduled.
 * @param eventId - The ID of the scheduled event to delete.
 * @param reason - The reason for deleting the scheduled event.
 * @returns A promise that resolves with the deleted event, or rejects with a DiscordAPIError.
 */
export default async (guildId: string, eventId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canDeleteScheduledEvent(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot delete scheduled event ${eventId}`, [
   PermissionFlagsBits.ManageEvents,
  ]);

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .deleteScheduledEvent(guildId, eventId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the necessary permissions to delete a scheduled event.
 * @param guildId - The guild ID.
 * @param botId - The bot's user ID.
 * @returns True if the guild member has the necessary permissions, false otherwise.
 */
export const canDeleteScheduledEvent = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageEvents'], userId);
