import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseWebhookUrl } from './parseWebhookUrl.js';

test('parses standard and versioned webhook URLs', () => {
 assert.deepEqual(
  parseWebhookUrl('https://discord.com/api/webhooks/123456789012345678/abc-DEF_123'),
  { id: '123456789012345678', token: 'abc-DEF_123' },
 );
 assert.deepEqual(parseWebhookUrl('https://discord.com/api/v10/webhooks/111/tok'), {
  id: '111',
  token: 'tok',
 });
});

test('parses canary, ptb, and discordapp hosts', () => {
 assert.deepEqual(parseWebhookUrl('https://canary.discord.com/api/webhooks/1/a'), {
  id: '1',
  token: 'a',
 });
 assert.deepEqual(parseWebhookUrl('https://ptb.discord.com/api/webhooks/2/b'), {
  id: '2',
  token: 'b',
 });
 assert.deepEqual(parseWebhookUrl('https://discordapp.com/api/webhooks/3/c'), {
  id: '3',
  token: 'c',
 });
});

test('ignores trailing path or query and rejects non-webhook URLs', () => {
 assert.deepEqual(parseWebhookUrl('https://discord.com/api/webhooks/9/tok?thread_id=5'), {
  id: '9',
  token: 'tok',
 });
 assert.equal(parseWebhookUrl('https://example.com/api/webhooks/9/tok'), null);
 assert.equal(parseWebhookUrl('not a url'), null);
 assert.equal(parseWebhookUrl('https://discord.com/channels/1/2/3'), null);
});
