import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GatewayMessageCreateDispatchData } from 'discord-api-types/v10';

import interpolate from '../../../Util/interpolate.js';

import { extractGifUrls, hasPendingEmbed } from './gifPool.js';

const msg = (partial: Partial<GatewayMessageCreateDispatchData>) =>
 ({ content: '', attachments: [], embeds: [], ...partial }) as GatewayMessageCreateDispatchData;

const gifvEmbed = (video: string, thumbnail: string) =>
 [{ type: 'gifv', video: { url: video }, thumbnail: { url: thumbnail } }] as unknown as
  GatewayMessageCreateDispatchData['embeds'];

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
  'https://cdn.discordapp.com/attachments/1/2/b.png',
  'https://example.com/a.gif',
  'https://c.tenor.com/someIdAC/tenor.gif',
 ]);
});

test('falls back to the embed thumbnail when the video is not an image', () => {
 const urls = extractGifUrls(
  msg({
   content: 'https://klipy.com/gifs/hello-september-2',
   embeds: gifvEmbed(
    'https://static.klipy.com/ii/a/b/c.mp4',
    'https://static.klipy.com/ii/a/b/d.webp',
   ),
  }),
 );

 assert.deepEqual(urls, ['https://static.klipy.com/ii/a/b/d.webp']);
});

test('takes one url per embed so a single gif is not weighted twice', () => {
 const urls = extractGifUrls(
  msg({
   content: 'https://tenor.com/view/lmfao-laughing-gif-25145562',
   embeds: gifvEmbed(
    'https://media.tenor.com/BiseY2UXovAAAAPo/x.mp4',
    'https://media1.tenor.com/m/BiseY2UXovAAAAAC/x.gif',
   ),
  }),
 );

 assert.equal(urls.length, 1);
 assert.equal(urls[0], 'https://c.tenor.com/BiseY2UXovAAAAAC/tenor.gif');
});

test('detects a gif link whose embed has not resolved yet', () => {
 assert.equal(
  hasPendingEmbed(msg({ content: 'https://tenor.com/view/x-1', embeds: [] })),
  true,
 );
 assert.equal(hasPendingEmbed(msg({ content: 'just text', embeds: [] })), false);
 assert.equal(
  hasPendingEmbed(
   msg({
    content: 'https://tenor.com/view/x-1',
    embeds: gifvEmbed('https://media.tenor.com/aAA/x.mp4', 'https://media1.tenor.com/m/aAC/x.gif'),
   }),
  ),
  false,
 );
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
