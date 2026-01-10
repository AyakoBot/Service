import { OverwriteType, PermissionFlagsBits } from '@discordjs/core';

import type Client from '../Classes/Client.js';

import getGuildPerms from './getGuildPerms.js';

export default async function (
 this: Client,
 guildId: string,
 userId: string,
 channelId: string,
): Promise<{ allow: bigint; deny: bigint; debug: number }> {
 const channel = await this.cache.channels.get(channelId);
 if (!channel) return { allow: 0n, deny: 0n, debug: 4 };

 const member = await this.cache.members.get(guildId, userId);
 if (!member) return { allow: 0n, deny: 0n, debug: 5 };

 const guildPerms = await getGuildPerms.call(this, guildId, userId);

 if (guildPerms.response & PermissionFlagsBits.Administrator) {
  return { allow: guildPerms.response, deny: 0n, debug: 9 };
 }

 let permissions = guildPerms.response;
 const overwrites = channel.permission_overwrites || [];

 const everyoneOverwrite = overwrites.find(
  (o) => o.type === OverwriteType.Role && o.id === guildId,
 );
 if (everyoneOverwrite) {
  permissions &= ~BigInt(everyoneOverwrite.deny);
  permissions |= BigInt(everyoneOverwrite.allow);
 }

 let roleAllow = 0n;
 let roleDeny = 0n;
 for (const overwrite of overwrites) {
  if (
   overwrite.type === OverwriteType.Role &&
   overwrite.id !== guildId &&
   member.roles.includes(overwrite.id)
  ) {
   roleAllow |= BigInt(overwrite.allow);
   roleDeny |= BigInt(overwrite.deny);
  }
 }
 permissions &= ~roleDeny;
 permissions |= roleAllow;

 const memberOverwrite = overwrites.find((o) => o.type === OverwriteType.Member && o.id === userId);
 if (memberOverwrite) {
  permissions &= ~BigInt(memberOverwrite.deny);
  permissions |= BigInt(memberOverwrite.allow);
 }

 return { allow: permissions, deny: 0n, debug: 0 };
}
