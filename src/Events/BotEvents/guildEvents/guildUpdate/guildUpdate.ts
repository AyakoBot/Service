import type * as Discord from 'discord.js';
import log from './log.js';

export default async (oldGuild: RGuild, guild: RGuild) => {
 log(oldGuild, guild);
};
