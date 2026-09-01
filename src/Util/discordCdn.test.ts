import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isDiscordCdnUrl, toDataUri } from './discordCdn.js';

describe('isDiscordCdnUrl', () => {
 it('accepts cdn.discordapp.com', () => {
  assert.equal(isDiscordCdnUrl('https://cdn.discordapp.com/emojis/123.png'), true);
 });

 it('accepts media.discordapp.net', () => {
  assert.equal(isDiscordCdnUrl('https://media.discordapp.net/attachments/1/2/x.png'), true);
 });

 it('rejects other hosts', () => {
  assert.equal(isDiscordCdnUrl('https://example.com/x.png'), false);
  assert.equal(isDiscordCdnUrl('https://cdn.discordapp.com.evil.com/x.png'), false);
 });

 it('rejects invalid urls', () => {
  assert.equal(isDiscordCdnUrl('not a url'), false);
  assert.equal(isDiscordCdnUrl(''), false);
 });
});

describe('toDataUri', () => {
 it('encodes buffers as base64 data uris', () => {
  assert.equal(toDataUri('image/png', Buffer.from('abc')), 'data:image/png;base64,YWJj');
 });
});
