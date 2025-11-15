import type { DiscordAPIError } from '@discordjs/rest';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';

/**
 * Removes a member from a guild.
 * @param guildId The guild ID where the member is.
 * @param userId The ID of the user to remove.
 * @param reason The reason for removing the member (optional).
 * @returns A promise that resolves with the removed member's data if successful,
 * or rejects with a DiscordAPIError if an error occurs.
 */
export default async (guildId: string, userId: string, reason?: string) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canRemoveMember(guildId, userId, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(
   `Cannot remove member ${userId} from ${guildId}`,
   [PermissionFlagsBits.KickMembers],
  );

  error(guildId, e);
  return e;
 }

 return (await getAPI(guildId)).guilds
  .removeMember(guildId, userId, { reason })
  .catch((e: DiscordAPIError) => {
   error(guildId, e);
   return e;
  });
};

/**
 * Checks if the given guild member has the permission to remove members.
 * @param guildId - The guild ID.
 * @param targetUserId - The ID of the user to remove.
 * @param userId - The user ID performing the action.
 * @returns True if the guild member has the permission to remove members, false otherwise.
 */
export const canRemoveMember = async (guildId: string, targetUserId: string, userId: string) => {
 if (!(await checkPermissions(guildId, ['KickMembers'], userId))) return false;

 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;
 if (guild.owner_id === targetUserId) return false;

 const botMember = await cache.members.get(guildId, userId);
 if (!botMember) return false;

 const targetMember = await cache.members.get(guildId, targetUserId);
 if (!targetMember) return true; 

 if (!botMember.roles.length) return false;

 const roles = await cache.roles.getAll(guildId);
 const botHighestRole = botMember.roles
  .sort(
   (a, b) => roles.find((r) => r.id === b)?.position! - roles.find((r) => r.id === a)?.position!,
  )
  .shift();

 const targetHighestRole = targetMember.roles
  .sort(
   (a, b) => roles.find((r) => r.id === b)?.position! - roles.find((r) => r.id === a)?.position!,
  )
  .shift();

 if (!botHighestRole) return false;
 if (!targetHighestRole) return true;

 return Number(roles.find((r) => r.id === botHighestRole)?.position) > Number(roles.find((r) => r.id === targetHighestRole)?.position);
};
