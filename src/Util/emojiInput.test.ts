import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emojiCdnUrl, formatEmoji, parseEmojiInput } from './emojiInput.js';

describe('parseEmojiInput', () => {
 it('parses static custom emojis', () => {
  assert.deepEqual(parseEmojiInput('<:pepe:123456789012345678>'), {
   id: '123456789012345678',
   name: 'pepe',
   animated: false,
  });
 });

 it('parses animated custom emojis', () => {
  assert.deepEqual(parseEmojiInput('<a:dance:123456789012345678>'), {
   id: '123456789012345678',
   name: 'dance',
   animated: true,
  });
 });

 it('parses unicode emojis', () => {
  assert.deepEqual(parseEmojiInput('😀'), { id: null, name: '😀', animated: false });
 });

 it('rejects plain text', () => {
  assert.equal(parseEmojiInput('hello'), null);
  assert.equal(parseEmojiInput(''), null);
 });
});

describe('emojiCdnUrl', () => {
 it('builds gif urls for animated emojis', () => {
  assert.equal(
   emojiCdnUrl({ id: '1', name: 'x', animated: true }),
   'https://cdn.discordapp.com/emojis/1.gif?size=4096',
  );
 });

 it('builds png urls for static emojis', () => {
  assert.equal(
   emojiCdnUrl({ id: '1', name: 'x', animated: false }),
   'https://cdn.discordapp.com/emojis/1.png?size=4096',
  );
 });

 it('returns null for unicode emojis', () => {
  assert.equal(emojiCdnUrl({ id: null, name: '😀', animated: false }), null);
 });
});

describe('formatEmoji', () => {
 it('formats custom emojis as mentions', () => {
  assert.equal(formatEmoji({ id: '1', name: 'x', animated: true }), '<a:x:1>');
  assert.equal(formatEmoji({ id: '1', name: 'x', animated: false }), '<:x:1>');
 });

 it('returns unicode emojis as-is', () => {
  assert.equal(formatEmoji({ id: null, name: '😀', animated: false }), '😀');
 });
});
