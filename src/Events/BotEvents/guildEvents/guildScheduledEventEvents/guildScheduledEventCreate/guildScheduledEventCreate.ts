import type * as Discord from 'discord.js';
import log from './log.js';

export default async (event: REvent) => {
 if (!event.guild) return;

 log(event);
};
