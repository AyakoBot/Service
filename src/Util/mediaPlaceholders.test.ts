/* eslint-disable @typescript-eslint/naming-convention */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
 decodeMediaPlaceholders,
 displayMediaUrl,
 encodeMediaPlaceholders,
 parseMediaUrl,
 toMediaMarker,
} from './mediaPlaceholders.js';
import { MessagePlaceholder } from './messagePlaceholders.js';

const gifMarker = toMediaMarker(MessagePlaceholder.Gif);
const avatarMarker = toMediaMarker(MessagePlaceholder.UserAvatar);

const tree = (gif: string, avatar: string) => [
 {
  type: 17,
  components: [
   { type: 10, content: '{{gif}}' },
   { type: 12, items: [{ media: { url: gif } }] },
   {
    type: 9,
    components: [{ type: 10, content: 'hi' }],
    accessory: { type: 11, media: { url: avatar } },
   },
   { type: 1, components: [{ type: 2, style: 5, label: 'x', url: '{{gif}}' }] },
  ],
 },
];

const embed = (gif: string, avatar: string) => ({
 url: '{{gif}}',
 image: { url: gif },
 author: { name: 'a', url: '{{gif}}', icon_url: avatar },
 footer: { text: 'f', icon_url: gif },
});

describe('media placeholders', () => {
 it('turns a media placeholder into a previewable marker url', () => {
  assert.equal(parseMediaUrl('{{gif}}'), gifMarker);
  assert.equal(parseMediaUrl(' {{ servericon }} '), toMediaMarker(MessagePlaceholder.ServerIcon));
  assert.equal(displayMediaUrl(gifMarker), '{{gif}}');
 });

 it('keeps real urls and rejects everything else', () => {
  assert.equal(parseMediaUrl('https://example.com/a.png'), 'https://example.com/a.png');
  assert.equal(parseMediaUrl('{{user}}'), null);
  assert.equal(parseMediaUrl('not a url'), null);
  assert.equal(displayMediaUrl('https://example.com/a.png'), 'https://example.com/a.png');
 });

 it('round-trips media urls in a component tree and leaves text and links alone', () => {
  assert.deepEqual(
   encodeMediaPlaceholders(tree('{{gif}}', '{{useravatar}}')),
   tree(gifMarker, avatarMarker),
  );
  assert.deepEqual(
   decodeMediaPlaceholders(tree(gifMarker, avatarMarker)),
   tree('{{gif}}', '{{useravatar}}'),
  );
 });

 it('round-trips media urls in an embed and leaves links alone', () => {
  assert.deepEqual(
   encodeMediaPlaceholders(embed('{{gif}}', '{{useravatar}}')),
   embed(gifMarker, avatarMarker),
  );
  assert.deepEqual(
   decodeMediaPlaceholders(embed(gifMarker, avatarMarker)),
   embed('{{gif}}', '{{useravatar}}'),
  );
 });
});
