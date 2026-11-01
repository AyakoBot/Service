import assert from 'node:assert/strict';
import { test } from 'node:test';

import type Client from '../Classes/Client.js';

import { countBots, memberCountVars, usesPlaceholder } from './memberCounts.js';
import { MessagePlaceholder } from './messagePlaceholders.js';

const users: Record<string, { bot?: boolean }> = {
 human: {},
 botA: { bot: true },
 botB: { bot: true },
 botC: { bot: true },
};

const client = {
 cache: {
  members: {
   keystore: (guildId: string) => `keystore:members:${guildId}`,
   redis: {
    hkeys: async () => [...Object.keys(users), 'expired'].map((id) => `cache:members:g:${id}`),
   },
  },
  users: { get: async (id: string) => users[id] ?? null },
 },
} as unknown as Client;

const emptyCache = {
 cache: {
  members: { keystore: () => '', redis: { hkeys: async () => [] } },
  users: { get: async () => null },
 },
} as unknown as Client;

const source = (total: number | undefined, cache = client) => {
 const calls: string[] = [];
 const host = {
  client: cache,
  name: 'test',
  getAPI: async () => {
   calls.push('getAPI');
   return { guilds: { get: async () => ({ approximate_member_count: total }) } };
  },
 } as unknown as ThisParameterType<typeof memberCountVars>;
 return { host, calls };
};

test('countBots counts cached bot users and skips members without a cached user', async () => {
 assert.equal(await countBots.call(client, 'g'), 3);
});

test('memberCountVars splits the member count into humans and bots', async () => {
 const { host } = source(8);
 const vars = await memberCountVars.call(host, 'g', { content: '{{humancount}} / {{botcount}}' });
 assert.deepEqual(vars, { membercount: '8', humancount: '5', botcount: '3' });
});

test('memberCountVars skips the bot scan when only membercount is used', async () => {
 const { host } = source(8);
 const vars = await memberCountVars.call(host, 'g', { content: '{{membercount}}' });
 assert.deepEqual(vars, { membercount: '8', humancount: '', botcount: '' });
});

test('memberCountVars does nothing when no count placeholder is used', async () => {
 const { host, calls } = source(8);
 assert.deepEqual(await memberCountVars.call(host, 'g', { content: '{{user}}' }), {});
 assert.deepEqual(calls, []);
});

test('memberCountVars leaves humancount empty when the total is unknown', async () => {
 const { host } = source(undefined);
 const vars = await memberCountVars.call(host, 'g', { content: '{{humancount}}' });
 assert.deepEqual(vars, { membercount: '', humancount: '', botcount: '3' });
});

test('an empty member cache leaves both counts empty instead of claiming zero bots', async () => {
 assert.equal(await countBots.call(emptyCache, 'g'), null);
 const { host } = source(8, emptyCache);
 const vars = await memberCountVars.call(host, 'g', { content: '{{humancount}} / {{botcount}}' });
 assert.deepEqual(vars, { membercount: '8', humancount: '', botcount: '' });
});

test('usesPlaceholder tolerates whitespace and undefined', () => {
 assert.equal(usesPlaceholder({ title: '{{ botcount }}' }, [MessagePlaceholder.BotCount]), true);
 assert.equal(usesPlaceholder({ title: '{{botcounts}}' }, [MessagePlaceholder.BotCount]), false);
 assert.equal(usesPlaceholder(undefined, [MessagePlaceholder.BotCount]), false);
});
