/* eslint-disable @typescript-eslint/naming-convention */
import { type Cache } from '@ayako/utility';
import { PermissionFlagsBits } from '@discordjs/core';

import type Client from '../Classes/Client.js';

export interface AutomodWhitelists {
 wlUserIds?: string[];
 wlRoleIds?: string[];
 wlChannelIds?: string[];
}

export interface AutomodMessage {
 author: { id: string; bot?: boolean };
 guild_id?: string;
 member?: { roles?: string[] } | null;
 channel_id: string;
}

export const resolveChannelChain = async function (
 this: typeof Cache.prototype,
 channelId: string,
): Promise<string[]> {
 const ids = new Set<string>([channelId]);

 const thread = await this.threads.get(channelId);
 const parentChannelId = thread?.parent_id ?? channelId;
 if (parentChannelId) ids.add(parentChannelId);

 const channel = await this.channels.get(parentChannelId);
 if (channel?.parent_id) ids.add(channel.parent_id);

 return [...ids];
};

export const isAdministrator = async function (
 this: typeof Cache.prototype,
 guildId: string,
 userId: string,
 roleIds: string[],
): Promise<boolean> {
 const guild = await this.guilds.get(guildId);
 if (!guild) return false;
 if (userId === guild.owner_id) return true;

 const roles = await this.roles.getAll(guildId);
 if (!roles.length) return false;

 const everyone = roles.find((role) => role.id === guildId);
 const held = roles.filter((role) => roleIds.includes(role.id));
 const applicable = everyone ? [everyone, ...held] : held;
 const permissions = applicable.reduce((acc, role) => acc | BigInt(role.permissions), 0n);

 return (permissions & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator;
};

export default async function (
 this: { client: Client },
 data: AutomodMessage,
 feature: AutomodWhitelists,
): Promise<boolean> {
 if (data.author.bot) return true;
 if (!data.guild_id) return true;

 const roleIds = data.member?.roles ?? [];

 if (await isAdministrator.call(this.client.cache, data.guild_id, data.author.id, roleIds)) {
  return true;
 }

 if (feature.wlUserIds?.includes(data.author.id)) return true;

 if (feature.wlRoleIds?.length && roleIds.some((id) => feature.wlRoleIds!.includes(id))) {
  return true;
 }

 if (feature.wlChannelIds?.length) {
  const chain = await resolveChannelChain.call(this.client.cache, data.channel_id);
  if (chain.some((id) => feature.wlChannelIds!.includes(id))) return true;
 }

 return false;
}
