import type { DiscordAPIError } from '@discordjs/rest';
import type { RESTPatchAPIGuildMemberJSONBody } from 'discord-api-types/v10.js';
import { PermissionFlagsBits } from 'discord-api-types/v10.js';
import error, { sendDebugMessage } from '../../error.js';
import checkPermissions from '../../checkPermissions.js';
import checkChannelPermissions from '../../checkChannelPermissions.js';
import getBotMemberFromGuild from '../../getBotMemberFromGuild.js';
import requestHandlerError from '../../requestHandlerError.js';
import { getAPI } from '../channels/addReaction.js';
import { cache } from '../../../Client.js';
import txtFileWriter from '../../txtFileWriter.js';

/**
 * Edits a member in a guild.
 * @param guildId The guild ID where the member is.
 * @param userId The ID of the user to edit.
 * @param body The data to update the member with.
 * @param reason The reason for editing the member.
 * @returns A promise that resolves with the updated guild member,
 * or rejects with a DiscordAPIError.
 */
export default async (
 guildId: string,
 userId: string,
 body: RESTPatchAPIGuildMemberJSONBody,
 reason?: string,
) => {
 if (process.argv.includes('--silent')) return new Error('Silent mode enabled.');

 if (!(await canEditMember(guildId, userId, body, (await getBotMemberFromGuild(guildId)).user_id))) {
  const e = requestHandlerError(
   `Cannot edit member ${userId}\nCheck role hierarchy.`,
   [
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.MoveMembers,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.ManageRoles,
   ],
  );

  error(guildId, e);
  return e;
 }

 const guild = await cache.guilds.get(guildId);
 if (!guild) return new Error('Guild not found');

 return (await getAPI(guildId)).guilds
  .editMember(guildId, userId, body, { reason })
  .then((m) => cache.members.apiToR(m, guildId))
  .catch(async (e: DiscordAPIError) => {
   const botMember = await getBotMemberFromGuild(guildId);
   const botFullMember = await cache.members.get(guildId, botMember.user_id);

   sendDebugMessage({
    content: `${userId} - ${guildId} - ${botFullMember?.permissions}`,
    files: [txtFileWriter(JSON.stringify(body, null, 2))],
   });

   error(guildId, e);
   return e;
  });
};
/**
 * Determines whether the given guild member can be edited with the provided body.
 * @param guildId - The guild ID.
 * @param targetUserId - The ID of the user being edited.
 * @param body - The JSON body containing the changes to be made.
 * @param botUserId - The user ID performing the edit.
 * @returns A boolean indicating whether the member can be edited.
 */
export const canEditMember = async (
 guildId: string,
 targetUserId: string,
 body: RESTPatchAPIGuildMemberJSONBody,
 botUserId: string,
) => {
 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;
 if (guild.owner_id === botUserId) return true;

 const botMember = await cache.members.get(guildId, botUserId);
 if (!botMember) return false;

 const targetMember = await cache.members.get(guildId, targetUserId);

 switch (true) {
  case 'channel_id' in body && body.channel_id !== targetMember?.voice?.channel_id: {
   if (!body.channel_id) {
    return checkPermissions(guildId, ['MoveMembers'], botUserId);
   }

   return checkChannelPermissions(guildId, body.channel_id, ['Connect'], botUserId);
  }
  case 'communication_disabled_until' in body: {
   if (!(await checkPermissions(guildId, ['ModerateMembers'], botUserId))) return false;
   if (!targetMember) return true;

   // Check if target has Administrator permission
   const targetRoles = await Promise.all(targetMember.roles.map((roleId) => cache.roles.get(roleId)));
   const targetPermissions = targetRoles.reduce((acc, role) => BigInt(role?.permissions || '0') | acc, 0n);
   if (targetPermissions & BigInt(PermissionFlagsBits.Administrator)) return false;

   // Check role hierarchy
   if (!botMember.roles.length) return false;
   if (!targetMember.roles.length) return true;

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
  }
  case 'mute' in body: {
   if (!targetMember?.voice?.channel_id) return false;
   return checkPermissions(guildId, ['MuteMembers'], botUserId);
  }
  case 'deaf' in body: {
   if (!targetMember?.voice?.channel_id) return false;
   return checkPermissions(guildId, ['DeafenMembers'], botUserId);
  }
  case 'nick' in body: {
   if (!(await checkPermissions(guildId, ['ManageNicknames'], botUserId))) return false;
   if (!targetMember) return true;

   if (!botMember.roles.length) return false;
   if (!targetMember.roles.length) return true;

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
  }
  case 'roles' in body: {
   if (!body.roles) {
    delete body.roles;
    if (Object.keys(body).length) return true;
    return false;
   }

   if (!targetMember) return true;
   if (!(await checkPermissions(guildId, ['ManageRoles'], botUserId))) return false;

   const currentRoles = targetMember.roles || [];
   const removedRoleIds = currentRoles.filter((r) => !body.roles?.includes(r));
   const addedRoleIds = body.roles.filter((r) => !currentRoles.includes(r));

   const roles = await cache.roles.getAll(guildId);
   const removedRoles = removedRoleIds.map((id) => roles.find((r) => r.id === id)).filter((r) => !!r);
   const addedRoles = addedRoleIds.map((id) => roles.find((r) => r.id === id)).filter((r) => !!r);

   // Check if any removed roles are managed
   if (removedRoles.some((r) => r.managed)) return false;
   // Check if any added roles are managed
   if (addedRoles.some((r) => r.managed)) return false;

   if (!botMember.roles.length) return false;

   const botHighestRole = botMember.roles
    .sort(
     (a, b) => roles.find((r) => r.id === b)?.position! - roles.find((r) => r.id === a)?.position!,
    )
    .shift();

   if (!botHighestRole) return false;
   const botHighestRolePosition = Number(roles.find((r) => r.id === botHighestRole)?.position);

   // Check if removed roles are below bot's highest role
   if (removedRoles.some((r) => r.position >= botHighestRolePosition)) return false;
   // Check if added roles are below bot's highest role
   if (addedRoles.some((r) => r.position >= botHighestRolePosition)) return false;

   return true;
  }
  default: {
   if (!targetMember) return true;

   if (!botMember.roles.length) return false;
   if (!targetMember.roles.length) return true;

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
  }
 }
};
