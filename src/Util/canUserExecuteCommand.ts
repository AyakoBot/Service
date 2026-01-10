import { ApplicationCommandPermissionType, PermissionFlagsBits } from '@discordjs/core';

import type Client from '../Classes/Client.js';

import getGuildPerms from './getGuildPerms.js';

export default async function (
 this: Client,
 commandName: string,
 guildId: string,
 userId: string,
 channelId: string,
): Promise<{ response: boolean; debug: number }> {
 // TODO: add custom clients here
 const commands = await this.cache.commands.getAll(this.user?.id || '0');
 const command = commands.find((c) => c.name === commandName);
 if (!command) return { response: true, debug: 1 };

 // eslint-disable-next-line @typescript-eslint/naming-convention
 const commandFilter = (p: { command_id: string }) => p.command_id === command.id;

 let commandPermissions = await this.cache.commandPermissions
  .getAll(guildId)
  .then((r) => r.filter(commandFilter));

 if (!commandPermissions.length) {
  // TODO: add custom clients here
  const newPerms = await this.api.applicationCommands
   .getGuildCommandsPermissions(this.user?.id || '0', guildId)
   .catch(() => null);

  commandPermissions = (
   newPerms?.filter((p) => p.id === command.id || p.id === this.user?.id) || []
  )
   .map((p) =>
    p.permissions.map((perm) => this.cache.commandPermissions.apiToR(perm, guildId, command.id)),
   )
   .flat(1);
 }

 const member = await this.cache.members.get(guildId, userId);
 if (!member) return { response: false, debug: 4 };

 const permissions = await getGuildPerms.call(this, guildId, userId);

 if (
  (permissions.response & PermissionFlagsBits.Administrator) ===
  PermissionFlagsBits.Administrator
 ) {
  return { response: true, debug: 3 };
 }

 if (
  !commandPermissions.length &&
  command.default_member_permissions &&
  (permissions.response & BigInt(command.default_member_permissions)) ===
   BigInt(command.default_member_permissions)
 ) {
  return { response: true, debug: 13 };
 }

 if (
  !commandPermissions.length &&
  (!command.default_member_permissions ||
   (BigInt(command.default_member_permissions) & permissions.response) ===
    BigInt(command.default_member_permissions))
 ) {
  return { response: true, debug: 2 };
 }

 if (!commandPermissions.length) return { response: false, debug: 5 };

 const userPermission = commandPermissions.find(
  (p) => p.type === ApplicationCommandPermissionType.User && p.id === userId,
 );
 if (userPermission) return { response: userPermission.permission, debug: 11 };

 const channelPermissions = commandPermissions.filter(
  (p) => p.type === ApplicationCommandPermissionType.Channel,
 );
 const channelPermission = channelPermissions.find((p) => p.id === channelId);
 const allChannelPermission = channelPermissions.find((p) => p.id === String(BigInt(guildId) - 1n));

 if (channelPermission && !channelPermission.permission) return { response: false, debug: 6 };
 if (allChannelPermission && !allChannelPermission.permission && !channelPermission?.permission) {
  return { response: false, debug: 7 };
 }

 const rolePermissions = commandPermissions.filter(
  (p) => p.type === ApplicationCommandPermissionType.Role,
 );
 const everyonePermission = rolePermissions.find((p) => p.id === guildId);
 const rolePermission = rolePermissions.filter((p) => member.roles.includes(p.id));

 if (rolePermission.find((p) => p.permission)) return { response: true, debug: 9 };
 if (rolePermission.find((p) => !p.permission)) return { response: false, debug: 14 };

 if (
  !everyonePermission &&
  command.default_member_permissions &&
  (BigInt(command.default_member_permissions) & permissions.response) !==
   BigInt(command.default_member_permissions)
 ) {
  return { response: false, debug: 12 };
 }
 if (everyonePermission && !everyonePermission.permission) {
  return { response: false, debug: 8 };
 }

 return { response: true, debug: 10 };
}
