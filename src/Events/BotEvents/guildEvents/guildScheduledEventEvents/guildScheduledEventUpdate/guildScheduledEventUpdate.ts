import type * as Discord from 'discord.js';
import log from './log.js';

export default async (
 oldEvent: REvent,
 event: REvent,
) => {
 if (!event.guild) return;

 log(oldEvent, event);
};
