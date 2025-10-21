import * as Discord from 'discord.js';
import error from '../../error.js';

import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';

/**
 * Deletes an invite for the given guild and code.
 * @param guild - The guild where the invite is created.
 * @param code - The code of the invite to delete.
 * @param reason - The reason for deleting the invite.
 * @returns A promise that resolves with the deleted invite or rejects with a DiscordAPIError.
 */
export default async (guild: RGuild, code: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!canDeleteInvite(await getBotMemberFromGuild(guild), code)) {
  const e = requestHandlerError(`Cannot delete invite ${code}`, [
   PermissionFlagsBits.ManageGuild,
   PermissionFlagsBits.ManageChannels,
  ]);

  error(guild, new Error((e as DiscordAPIError).message));
  return e;
 }

 return (await getAPI(guild)).invites
  .delete(code, { reason })
  .catch((e: DiscordAPIError) => {
   error(guild, new Error((e as DiscordAPIError).message));
   return e;
  });
};

/**
 * Checks if the given guild member has the necessary permissions to delete an invite.
 * @param me - The Discord guild member.
 * @returns True if the guild member has the necessary permissions, false otherwise.
 */
export const canDeleteInvite = (me: RMember, channelId: string) =>
 me.permissions.has(PermissionFlagsBits.ManageGuild) ||
 me.permissionsIn(channelId).has(PermissionFlagsBits.ManageChannels);
