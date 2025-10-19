import * as Discord from 'discord.js';

export default async (log: RAuditLog, guild: Discord.Guild) => {
 guild.client.util.cache.auditLogs.set(guild.id, log);
};
