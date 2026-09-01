import type { APIGuild, APIUser } from 'discord-api-types/v10';

import type Client from '../Classes/Client.js';

import { snowflakeToMs } from './snowflakeToMs.js';

export type PlaceholderVars = Record<string, string>;

const discordEpoch = 1420070400000;

const avatarUrl = (user: APIUser) =>
 (user.avatar
  ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`
  : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`);

const iconUrl = (guild: Pick<APIGuild, 'id' | 'icon'> | null) =>
 (guild?.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=1024` : '');

const createdStamp = (id: string) => {
 const ms = snowflakeToMs(id) ?? Number(BigInt(id) >> 22n) + discordEpoch;
 return `<t:${Math.floor(ms / 1000)}:D>`;
};

export const serverVars = async function (
 this: { client: Client },
 guildId: string,
 membercount = '',
): Promise<PlaceholderVars> {
 const guild = await this.client.cache.guilds.get(guildId);

 return {
  server: guild?.name ?? '',
  serverid: guildId,
  servericon: iconUrl(guild ?? null),
  membercount,
  boostcount: String(guild?.premium_subscription_count ?? 0),
  boosttier: String(guild?.premium_tier ?? 0),
 };
};

export const memberVars = (user: APIUser): PlaceholderVars => ({
 user: `<@${user.id}>`,
 username: user.username,
 displayname: user.global_name ?? user.username,
 userid: user.id,
 useravatar: avatarUrl(user),
 usercreated: createdStamp(user.id),
});
