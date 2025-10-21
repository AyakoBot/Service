import * as Discord from 'discord.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Retrieves the widget settings for a given guild.
 * @param guild - The guild to retrieve the widget settings for.
 * @returns A promise that resolves to an object containing the widget
 * settings (enabled and channelId).
 */
export default async (guild: RGuild) => {
 if (!canGetWidgetSettings(await getBotMemberFromGuild(guild))) {
  const e = requestHandlerError(`Cannot get widget settings`, [
   PermissionFlagsBits.ManageGuild,
  ]);

  error(guild, new Error((e as DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).guilds
  .getWidgetSettings(guild.id)
  .then((w) => ({ enabled: w.enabled, channelId: w.channel_id }))
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
};
/**
 * Checks if the given guild member has the permission to get widget settings.
 * @param me - The Discord guild member.
 * @returns True if the guild member has the permission to get widget settings, false otherwise.
 */
export const canGetWidgetSettings = (me: RMember) =>
 me.permissions.has(PermissionFlagsBits.ManageGuild);
