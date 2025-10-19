import type * as Discord from 'discord.js';
import log from './log.js';
import cache from './cache.js';

export default async (oldUser: RUser, user: RUser) => {
 const guilds = user.client.guilds.cache.filter((g) => g.members.cache.has(user.id));
 if (!guilds.size) return;

 guilds.forEach((g) => log(oldUser, user, g));
 cache(user);
};
