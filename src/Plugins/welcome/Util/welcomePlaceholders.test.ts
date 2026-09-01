import assert from 'node:assert/strict';
import { test } from 'node:test';

import { gifInUrlSlot, hasGifPlaceholder, usesMemberCount } from './welcomePlaceholders.js';

test('gifInUrlSlot only fires when the placeholder sits in a url field', () => {
 assert.equal(gifInUrlSlot({ image: { url: '{{gif}}' } }), true);
 assert.equal(gifInUrlSlot([{ items: [{ media: { url: '{{ gif }}' } }] }]), true);
 assert.equal(gifInUrlSlot({ description: 'here: {{gif}}' }), false);
 assert.equal(gifInUrlSlot({ description: 'no placeholder' }), false);
 assert.equal(gifInUrlSlot(undefined), false);
});

test('placeholder detectors tolerate undefined and whitespace', () => {
 assert.equal(hasGifPlaceholder({ description: '{{ gif }}' }), true);
 assert.equal(hasGifPlaceholder(undefined), false);
 assert.equal(usesMemberCount({ title: 'we are {{membercount}}' }), true);
 assert.equal(usesMemberCount(undefined), false);
});
