import assert from 'node:assert';
import { test } from 'node:test';

import { isBotPresent } from './botPresence.js';

const fakeCache = (byKey: Record<string, string[]>) =>
 ({ cacheDb: { smembers: async (key: string) => byKey[key] ?? [] } }) as never;

test('isBotPresent is true when the fleet key is in gw:presence for the guild', async () => {
 // eslint-disable-next-line @typescript-eslint/naming-convention
 const cache = fakeCache({ 'gw:presence:G1': ['MAIN_TOKEN', 'AFK_TOKEN'] });
 assert.strictEqual(await isBotPresent(cache, 'G1', 'AFK_TOKEN'), true);
});

test('isBotPresent is false when the key is absent or the guild has no set', async () => {
 // eslint-disable-next-line @typescript-eslint/naming-convention
 const cache = fakeCache({ 'gw:presence:G1': ['MAIN_TOKEN'] });
 assert.strictEqual(await isBotPresent(cache, 'G1', 'AFK_TOKEN'), false);
 assert.strictEqual(await isBotPresent(cache, 'G2', 'AFK_TOKEN'), false);
});
