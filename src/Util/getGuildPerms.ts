import { PermissionFlagsBits } from '@discordjs/core';

import type Client from '../Classes/Client.js';

export default async function (
 this: Client,
 guildId: string,
 userId: string,
): Promise<{ response: bigint; debug: number }> {
 const member = await this.cache.members.get(guildId, userId);
 if (!member) return { response: 0n, debug: 4 };

 const guild = await this.cache.guilds.get(guildId);
 if (!guild) return { response: 0n, debug: 8 };

 if (member.user_id === guild.owner_id) {
  return { response: PermissionFlagsBits.Administrator, debug: 9 };
 }

 const roles = await this.cache.roles.getAll(guildId);
 if (!roles.length) return { response: 0n, debug: 10 };

 const everyoneRole = roles.find((r) => r.id === guildId);
 const memberRoles = roles.filter((r) => member.roles.includes(r.id));
 const allRoles = everyoneRole ? [everyoneRole, ...memberRoles] : memberRoles;
 const permissions = allRoles.reduce((acc, role) => acc | BigInt(role.permissions), 0n);

 return { response: permissions, debug: 0 };
}
