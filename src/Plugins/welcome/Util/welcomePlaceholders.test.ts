/* eslint-disable @typescript-eslint/naming-convention */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MessagePlaceholder } from '../../../Util/messagePlaceholders.js';

import { hasGifPlaceholder, mediaInUrlSlot, unfilledMediaSlot } from './welcomePlaceholders.js';

const gif = MessagePlaceholder.Gif;

test('mediaInUrlSlot only fires when the placeholder sits in a url field', () => {
 assert.equal(mediaInUrlSlot({ image: { url: '{{gif}}' } }, gif), true);
 assert.equal(mediaInUrlSlot([{ items: [{ media: { url: '{{ gif }}' } }] }], gif), true);
 assert.equal(mediaInUrlSlot({ footer: { icon_url: '{{gif}}' } }, gif), true);
 assert.equal(mediaInUrlSlot({ description: 'here: {{gif}}' }, gif), false);
 assert.equal(mediaInUrlSlot({ description: 'no placeholder' }, gif), false);
 assert.equal(mediaInUrlSlot(undefined, gif), false);
});

test('unfilledMediaSlot names the media placeholder that has no value', () => {
 const design = [{ items: [{ media: { url: '{{servericon}}' } }] }];
 assert.equal(unfilledMediaSlot(design, { servericon: '' }), MessagePlaceholder.ServerIcon);
 assert.equal(unfilledMediaSlot(design, { servericon: 'https://cdn.example/icon.png' }), null);
 assert.equal(unfilledMediaSlot({ description: '{{gif}}' }, { gif: '' }), null);
});

test('placeholder detectors tolerate undefined and whitespace', () => {
 assert.equal(hasGifPlaceholder({ description: '{{ gif }}' }), true);
 assert.equal(hasGifPlaceholder(undefined), false);
});
