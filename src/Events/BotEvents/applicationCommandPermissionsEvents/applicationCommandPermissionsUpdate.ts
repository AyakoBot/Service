import * as Discord from 'discord.js';
import client from '../../../BaseClient/Client.js';
import cache from './cache.js';
import log from './log.js';

export default async (data: RCommandPermissionsUpdateData) => {
 if (!data.guildId) return;

 const guild = client.guilds.cache.get(data.guildId);
 if (!guild) return;

 await client.util.firstGuildInteraction(guild, Discord.Events.ApplicationCommandPermissionsUpdate);

 log(data, guild);
 cache(data, guild);
};
