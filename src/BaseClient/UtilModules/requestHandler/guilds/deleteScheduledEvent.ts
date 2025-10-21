import * as Discord from 'discord.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes a scheduled event for a guild.
 * @param guild - The guild where the event is scheduled.
 * @param eventId - The ID of the scheduled event to delete.
 * @param reason - The reason for deleting the scheduled event.
 * @returns A promise that resolves with the deleted event, or rejects with a DiscordAPIError.
 */
export default async (guild: RGuild, eventId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canDeleteScheduledEvent(await getBotMemberFromGuild(guild))) {
  const e = requestHandlerError(`Cannot delete scheduled event ${eventId}`, [
   PermissionFlagsBits.ManageEvents,
  ]);

  error(guild, new Error((e as DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).guilds
  .deleteScheduledEvent(guild.id, eventId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
};

/**
 * Checks if the given guild member has the necessary permissions to delete a scheduled event.
 * @param me - The Discord guild member.
 * @returns True if the guild member has the necessary permissions, false otherwise.
 */
export const canDeleteScheduledEvent = (me: RMember) =>
 me.permissions.has(PermissionFlagsBits.ManageEvents);
