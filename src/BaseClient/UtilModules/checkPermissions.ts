import { PermissionFlagsBits } from 'discord-api-types/v10';
import { cache } from '../Client.js';

export default async (
 guildId: string,
 requiredPermissions: (keyof typeof PermissionFlagsBits)[],
 userId: string,
) => {
 if (!requiredPermissions.length) return true;

 const member = await cache.members.get(guildId, userId);
 if (!member) return false;
 if (!requiredPermissions.length) return true;

 const roles = await Promise.all(member.roles.map((roleId) => cache.roles.get(roleId)));
 const permissions = roles.reduce((acc, role) => BigInt(role?.permissions || '0') | acc, 0n);

 if (permissions & BigInt(PermissionFlagsBits.Administrator)) return true;

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
