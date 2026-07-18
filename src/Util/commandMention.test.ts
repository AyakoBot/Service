import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RequestHandlerError, type API } from '@ayako/api';

import commandMention from './commandMention.js';

const api = (botId: string, result: unknown) =>
 ({
  botId,
  applicationCommands: { getGlobalCommands: async () => result },
 }) as unknown as API;

test('builds a mention from the fetched command id', async () => {
 const mention = await commandMention.call(
  api('100', [{ name: 'reminder', id: '111' }]),
  'reminder create',
 );
 assert.equal(mention, '</reminder create:111>');
});

test('caches per bot identity', async () => {
 assert.equal(await commandMention.call(api('200', [{ name: 'tag', id: '1' }]), 'tag'), '</tag:1>');
 assert.equal(await commandMention.call(api('200', [{ name: 'tag', id: '2' }]), 'tag'), '</tag:1>');
 assert.equal(await commandMention.call(api('201', [{ name: 'tag', id: '2' }]), 'tag'), '</tag:2>');
});

test('falls back to plain text for unknown commands', async () => {
 assert.equal(await commandMention.call(api('300', []), 'missing sub'), '`/missing sub`');
});

test('does not cache failed fetches', async () => {
 const error = new RequestHandlerError({ applicationId: '400', guildId: undefined }, 'down');
 assert.equal(await commandMention.call(api('400', error), 'afk'), '`/afk`');
 assert.equal(await commandMention.call(api('400', [{ name: 'afk', id: '4' }]), 'afk'), '</afk:4>');
});
