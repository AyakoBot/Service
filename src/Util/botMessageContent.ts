import type { API } from '@ayako/api';

import { buildAppIdTokenMap } from './appIdTokens.js';
import { hasMessageContentIntent } from './messageContentIntent.js';

const tokens = buildAppIdTokenMap();
const cache = new Map<string, Promise<boolean>>();

export const botHasMessageContent = (api: API): Promise<boolean> => {
 const cached = cache.get(api.botId);
 if (cached) return cached;

 const token = tokens.get(api.botId);
 const pending = token ? hasMessageContentIntent(token).catch(() => true) : Promise.resolve(true);

 cache.set(api.botId, pending);
 return pending;
};
