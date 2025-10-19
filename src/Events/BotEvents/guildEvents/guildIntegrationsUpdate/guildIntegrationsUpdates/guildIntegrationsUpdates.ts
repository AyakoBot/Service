import type * as Discord from 'discord.js';
import log from './log.js';

export default async (
 oldIntegration: RIntegration | undefined,
 integration: RIntegration,
) => {
 if (!oldIntegration) return;
 log(oldIntegration, integration);
};
