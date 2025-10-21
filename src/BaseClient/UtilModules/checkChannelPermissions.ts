import { OverwriteType, PermissionFlagsBits, type APIOverwrite } from 'discord-api-types/v10';
import { cache } from '../Client.js';

const timeoutDeniedPermissions: ReadonlyArray<bigint> = [
 PermissionFlagsBits.AddReactions,
 PermissionFlagsBits.SendMessages,
 PermissionFlagsBits.ChangeNickname,
 PermissionFlagsBits.Connect,
 PermissionFlagsBits.CreateEvents,
 PermissionFlagsBits.CreateGuildExpressions,
 PermissionFlagsBits.CreatePrivateThreads,
 PermissionFlagsBits.CreatePublicThreads,
 PermissionFlagsBits.DeafenMembers,
 PermissionFlagsBits.KickMembers,
 PermissionFlagsBits.ManageChannels,
 PermissionFlagsBits.ManageEmojisAndStickers,
 PermissionFlagsBits.ManageEvents,
 PermissionFlagsBits.ManageGuild,
 PermissionFlagsBits.ManageGuildExpressions,
 PermissionFlagsBits.ManageMessages,
 PermissionFlagsBits.ManageNicknames,
 PermissionFlagsBits.ManageRoles,
 PermissionFlagsBits.ManageThreads,
 PermissionFlagsBits.ManageWebhooks,
 PermissionFlagsBits.ModerateMembers,
 PermissionFlagsBits.MoveMembers,
 PermissionFlagsBits.MuteMembers,
 PermissionFlagsBits.PinMessages,
 PermissionFlagsBits.SendMessagesInThreads,
 PermissionFlagsBits.UseApplicationCommands,
 PermissionFlagsBits.ViewAuditLog,
] as const;

export default async (
 guildId: string,
 channelId: string,
 requiredPermissions: (keyof typeof PermissionFlagsBits)[],
 userId: string,
) => {
 if (!requiredPermissions.length) return true;
 if (!userId.length) return false;

 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;
 if (userId === guild.owner_id) return true;

 const member = await cache.members.get(guildId, userId);
 if (!member) return false;

 let channel = await cache.channels.get(channelId);

 if (!channel) {
  const thread = await cache.threads.get(channelId);
  if (!thread) return false;
  if (thread.guild_id !== guildId) return false;

  const parentId = thread.parent_id;
  if (!parentId) return false;

  channel = await cache.channels.get(parentId);
  if (!channel) return false;
 }

 if (channel.guild_id !== guildId) return false;

 const everyoneRole = await cache.roles.get(guildId);
 const memberRoles = await Promise.all(member.roles.map((roleId) => cache.roles.get(roleId)));
 const allRoles = [everyoneRole, ...memberRoles].filter((role) => !!role);

 let permissions = allRoles.reduce((acc, role) => BigInt(role.permissions) | acc, 0n);

 if (permissions & BigInt(PermissionFlagsBits.Administrator)) return true;

 if (member.communication_disabled_until) {
  const timeoutEnd = new Date(member.communication_disabled_until).getTime();
  if (timeoutEnd > Date.now()) {
   const requestingDeniedPerm = requiredPermissions.some((perm) =>
    timeoutDeniedPermissions.includes(BigInt(PermissionFlagsBits[perm])),
   );
   if (requestingDeniedPerm) return false;
  }
 }

 if (!(permissions & BigInt(PermissionFlagsBits.ViewChannel))) return false;

 const everyoneOverwrite = channel.permission_overwrites?.find(
  (overwrite: APIOverwrite) => overwrite.id === guildId,
 );

 if (everyoneOverwrite) {
  permissions &= ~BigInt(everyoneOverwrite.deny);
  permissions |= BigInt(everyoneOverwrite.allow);
 }

 const roleOverwrites = channel.permission_overwrites?.filter(
  (overwrite: APIOverwrite) =>
   overwrite.type === OverwriteType.Role && member.roles.includes(overwrite.id),
 );

 if (roleOverwrites && roleOverwrites.length > 0) {
  for (const overwrite of roleOverwrites) permissions &= ~BigInt(overwrite.deny);
  for (const overwrite of roleOverwrites) permissions |= BigInt(overwrite.allow);
 }

 const memberOverwrite = channel.permission_overwrites?.find(
  (overwrite: APIOverwrite) => overwrite.type === OverwriteType.Member && overwrite.id === userId,
 );
 if (memberOverwrite) {
  permissions &= ~BigInt(memberOverwrite.deny);
  permissions |= BigInt(memberOverwrite.allow);
 }

 if (!(permissions & BigInt(PermissionFlagsBits.ViewChannel))) return false;

 if (
  !requiredPermissions.every(
   (perm) =>
    (permissions & BigInt(PermissionFlagsBits[perm])) === BigInt(PermissionFlagsBits[perm]),
  )
 ) {
  return false;
 }

 return true;
};
