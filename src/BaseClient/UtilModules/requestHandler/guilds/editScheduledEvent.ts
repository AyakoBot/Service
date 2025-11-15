import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildScheduledEventJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';
import { resolveImage } from '../../util.js';

/**
 * Edits a scheduled event for a guild.
 * @param guildId The guild ID where the scheduled event belongs.
 * @param eventId The ID of the scheduled event to edit.
 * @param body The new data for the scheduled event.
 * @param reason The reason for editing the scheduled event.
 * @returns A promise that resolves with the edited scheduled event,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 eventId: string,
 body: RESTPatchAPIGuildScheduledEventJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEditScheduledEvent(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot edit scheduled event ${eventId}`, [
   PermissionFlagsBits.ManageEvents,
  ]);

  error(guildId, e);
  return e;
 }

 const resolvedImage = body.image ? await resolveImage(body.image) : body.image;

 return (await getAPI(guildId)).guilds
  .editScheduledEvent(
   guildId,
   eventId,
   {
    ...body,
    image: resolvedImage,
   },
   { reason },
  )
  .then((e) => cache.events.apiToR(e))
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the necessary permissions to edit a scheduled event.
 * @param guildId - The guild ID.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has the "Manage Events" permission, false otherwise.
 */
export const canEditScheduledEvent = (guildId: string, userId: string) =>
 checkPermissions(guildId, ['ManageEvents'], userId);
