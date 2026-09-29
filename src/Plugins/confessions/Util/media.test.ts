import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isImageLink } from './media.js';

describe('confessions image links', () => {
 it('accepts direct https image links, query strings included', () => {
  assert.equal(isImageLink('https://i.imgur.com/abc.png'), true);
  assert.equal(isImageLink('https://cdn.discordapp.com/attachments/1/2/cat.JPEG?ex=1&is=2'), true);
  assert.equal(isImageLink('https://media.tenor.com/x/dance.gif'), true);
  assert.equal(isImageLink('https://example.com/pic.webp'), true);
 });

 it('rejects plain http, non-image paths and garbage', () => {
  assert.equal(isImageLink('http://i.imgur.com/abc.png'), false);
  assert.equal(isImageLink('https://example.com/page'), false);
  assert.equal(isImageLink('https://example.com/file.png.exe'), false);
  assert.equal(isImageLink('not a link'), false);
  assert.equal(isImageLink(''), false);
 });
});
