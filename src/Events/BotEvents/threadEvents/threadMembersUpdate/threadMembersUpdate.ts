import type * as Discord from 'discord.js';
import log from './log.js';

export default async (
 added: Discord.Collection<Discord.Snowflake, Discord.ThreadMember>,
 removed: Discord.Collection<Discord.Snowflake, Discord.ThreadMember>,
 thread: RThread,
) => {
 log(added, removed, thread);
};
