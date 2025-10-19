import type * as Discord from 'discord.js';
import log from './log.js';

export default async (event: REvent, user: RUser) => {
 event.client.util.cache.scheduledEventUsers.add(user, event.guildId, event.id);

 if (!event.guild) return;

 log(event, user);
};
