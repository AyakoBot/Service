import type * as Discord from 'discord.js';
import log from './log.js';

export default async (
 oldRule: RAutomod | undefined,
 rule: RAutomod,
) => {
 log(oldRule, rule);
};
