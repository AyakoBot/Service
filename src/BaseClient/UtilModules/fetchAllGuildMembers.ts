import * as Discord from 'discord.js';
import { request } from './requestHandler.js';

/**
 * Fetches all members of a guild.
 * @param guild - The guild to fetch members from.
 * @returns An array of guild members.
 */
export default async (guild: RGuild) => {
 if (guild.memberCount === guild.members.cache.size) {
  return Array.from(guild.members.cache.values());
 }

 const members: RMember[] = [];

 const fetches = Math.ceil(guild.memberCount / 1000);
 for (let i = 0; i < fetches; i += 1) {
  // eslint-disable-next-line no-await-in-loop
  const u = await request.guilds.getMembers(guild, {
   limit: 1000,
   after: members.at(-1)?.user?.id,
  });

  if ('message' in u) return [];
  u.forEach((m) => members.push(m));
 }

 return members;
};
