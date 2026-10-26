import type TicketPlugin from '../Plugin.js';

import type { SnippetRun } from './runSnippet.js';

const pickTtlSeconds = 900;
const pickKey = (id: string) => `tickets:contactPick:${id}`;

export interface PendingPick extends Omit<SnippetRun, 'feedback' | 'systemId'> {
 snippetId: string;
}

export const savePick = function (this: TicketPlugin, id: string, pick: PendingPick) {
 return this.client.cache.cacheDb.set(pickKey(id), JSON.stringify(pick), 'EX', pickTtlSeconds);
};

export const loadPick = async function (
 this: TicketPlugin,
 id: string,
): Promise<PendingPick | null> {
 const raw = id ? await this.client.cache.cacheDb.get(pickKey(id)) : null;
 return raw ? (JSON.parse(raw) as PendingPick) : null;
};

export const dropPick = function (this: TicketPlugin, id: string) {
 return this.client.cache.cacheDb.del(pickKey(id));
};
