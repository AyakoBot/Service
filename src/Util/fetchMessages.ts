import { RequestHandlerError, type API } from '@ayako/api';
import type { RMessage, RUser } from '@ayako/utility';
import type { APIMessage } from 'discord-api-types/v10';

import type Client from '../Classes/Client.js';

export default async function (
 this: Client,
 channelId: string,
 guildId: string,
 filter: {
  amount: number;
  before?: string;
  after?: string;
  isDm?: boolean;
  abortWhen?: (msg: (RMessage & { user?: RUser }) | APIMessage) => boolean;
 },
 debugInfo: { origin: string; reason: string },
 overrideApi?: API,
) {
 const messages: ((RMessage & { user?: RUser }) | APIMessage)[] = [];
 const api = overrideApi ?? (await this.getAPI(guildId));
 let lastAmount = 0;

 const afterFloor = filter.after ? BigInt(filter.after) : null;

 for (let i = 0; i < filter.amount / 100; i += 1) {
  const query: { limit: number; before?: string } = {
   limit: Math.min(100, filter.amount - messages.length),
   before: messages.at(-1)?.id ?? filter.before,
  };

  const msgs = await (filter.isDm
   ? api.channels.getDirectMessages(channelId, query, debugInfo)
   : api.channels.getMessages(channelId, query, debugInfo));

  if (msgs instanceof RequestHandlerError) return [];
  if (msgs.length === 0) break;

  const inRange = afterFloor !== null ? msgs.filter((m) => BigInt(m.id) > afterFloor) : msgs;

  const fresh = inRange.filter((m) => !messages.some((m2) => m2.id === m.id));
  messages.push(...fresh);

  if (filter.abortWhen && fresh.some(filter.abortWhen)) break;
  if (messages.length >= filter.amount) break;
  if (inRange.length < msgs.length) break;
  if (fresh.length === 0) break;
  if (msgs.length === lastAmount && msgs.length < 100) break;

  lastAmount = msgs.length;
 }

 return messages.slice(0, filter.amount);
}
