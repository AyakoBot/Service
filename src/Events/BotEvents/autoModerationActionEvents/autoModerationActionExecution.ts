import type * as Discord from 'discord.js';

import censor from './censor.js';
import invites from './invites.js';
import log from './log.js';
import wordscraper from './wordscraper.js';

export default async (msg: Discord.AutoModerationActionExecution) => {
 log(msg);
 wordscraper(msg);
 censor(msg);
 invites(msg);
};
