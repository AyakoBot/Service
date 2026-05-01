import { RequestHandlerError } from '@ayako/api';
import type { RMessage, RUser } from '@ayako/utility';
import type { APIMessage } from 'discord-api-types/v10';
import type Client from '../Classes/Client.js';

/**
 * Fetches up to `filter.amount` messages from a channel, newest-first,
 * optionally bounded by `before` (exclusive upper) and `after` (exclusive lower).
 * @param channelId The id of the channel to read from.
 * @param guildId The id of the guild whose API client to use.
 * @param filter Amount to fetch, optional `before`/`after` bounds, and `isDm` flag.
 * @returns The fetched messages in newest-first order, or `[]` on request failure.
 */
export default async function (
 this: Client,
 channelId: string,
 guildId: string,
 filter: { amount: number; before?: string; after?: string; isDm?: boolean },
 debugInfo: { origin: string; reason: string },
) {
 const messages: ((RMessage & { user?: RUser }) | APIMessage)[] = [];
 const api = await this.getAPI(guildId);
 let lastAmount = 0;

 const afterFloor = filter.after ? BigInt(filter.after) : null;

 for (let i = 0; i < filter.amount / 100; i += 1) {
  const query: { limit: number; before?: string } = {
   limit: Math.min(100, filter.amount - messages.length),
   before: messages.at(-1)?.id ?? filter.before,
  };

  // eslint-disable-next-line no-await-in-loop
  const msgs = await (filter.isDm
   ? api.channels.getDirectMessages(channelId, query, debugInfo)
   : api.channels.getMessages(channelId, query, debugInfo));

  if (msgs instanceof RequestHandlerError) return [];
  if (msgs.length === 0) break;

  const inRange = afterFloor !== null ? msgs.filter((m) => BigInt(m.id) > afterFloor) : msgs;

  const fresh = inRange.filter((m) => !messages.some((m2) => m2.id === m.id));
  messages.push(...fresh);

  if (messages.length >= filter.amount) break;
  if (inRange.length < msgs.length) break;
  if (fresh.length === 0) break;
  if (msgs.length === lastAmount && msgs.length < 100) break;

  lastAmount = msgs.length;
 }

 return messages.slice(0, filter.amount);
}
