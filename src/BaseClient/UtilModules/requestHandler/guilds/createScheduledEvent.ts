import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPostAPIGuildScheduledEventJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import { cache } from '../../../Client.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { resolveImage } from '../../util.js';

/**
 * Creates a scheduled event for a guild.
 * @param guildId The guild ID to create the scheduled event for.
 * @param body The data for the scheduled event.
 * @param reason The reason for creating the scheduled event.
 * @returns A promise that resolves with the created scheduled event
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 body: RESTPostAPIGuildScheduledEventJSONBody,
 reason?: string,
) => {
 if (!(await canCreateScheduledEvent(guildId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(`Cannot create scheduled event`, [
   PermissionFlagsBits.ManageEvents,
  ]);

  error(guildId, e);
  return e;
 }

 const resolvedImage = body.image ? await resolveImage(body.image) : body.image;

 return (await getAPI(guildId)).guilds
  .createScheduledEvent(
   guildId,
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
 * Checks if the given guild member has the necessary permissions to create a scheduled event.
 * @param guildId - The guild ID.
 * @param botId - The bot's user ID.
 * @returns True if the guild member has the "Manage Events" permission, false otherwise.
 */
export const canCreateScheduledEvent = async (guildId: string, userId: string) => {
 const hasCreate = await checkPermissions(guildId, ['CreateEvents'], userId);
 if (hasCreate) return true;

 const hasManage = await checkPermissions(guildId, ['ManageEvents'], userId);
 return hasManage;
};
