import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GatewayMessageCreateDispatchData } from 'discord-api-types/v10';

import { extractGifUrls } from './gifPool.js';
import interpolate from './interpolate.js';

const msg = (partial: Partial<GatewayMessageCreateDispatchData>) =>
 ({ content: '', attachments: [], embeds: [], ...partial }) as GatewayMessageCreateDispatchData;

test('extracts attachment, content, and tenor-converted urls, deduped and filtered', () => {
 const urls = extractGifUrls(
  msg({
   content:
    'https://example.com/a.gif https://example.com/a.gif https://tenor.com/view/thing-123 https://example.com/page.html',
   attachments: [
    { url: 'https://cdn.discordapp.com/attachments/1/2/b.png?ex=abc' },
   ] as GatewayMessageCreateDispatchData['attachments'],
   embeds: [
    { video: { url: 'https://media.tenor.com/someIdAA/thing.mp4' } },
   ] as GatewayMessageCreateDispatchData['embeds'],
  }),
 );

 assert.deepEqual(urls, [
  'https://cdn.discordapp.com/attachments/1/2/b.png?ex=abc',
  'https://example.com/a.gif',
  'https://c.tenor.com/someIdAC/tenor.gif',
 ]);
});

test('interpolates string leaves recursively and leaves unknown vars untouched', () => {
 const result = interpolate(
  {
   title: 'Hi {{username}}',
   nested: { items: ['{{server}}', 42, null] },
   unknown: '{{nope}}',
  },
  { username: 'Lars', server: 'Ayako' },
 );

 assert.deepEqual(result, {
  title: 'Hi Lars',
  nested: { items: ['Ayako', 42, null] },
  unknown: '{{nope}}',
 });
});
