import type * as Discord from 'discord.js';
import log from './log.js';

export default async (entry: RAuditLog, guild: Discord.Guild) => {
 log(entry, guild);
};
