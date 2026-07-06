import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanPreview } from './cleanPreview.js';

test('shortens custom and animated emoji to their name', () => {
 assert.equal(cleanPreview('hi <:wave:123456789012345678>'), 'hi :wave:');
 assert.equal(cleanPreview('<a:spin:987654321098765432> go'), ':spin: go');
});

test('collapses mentions to readable tokens', () => {
 assert.equal(cleanPreview('hey <@123456789012345678>'), 'hey @user');
 assert.equal(cleanPreview('<@!123456789012345678>'), '@user');
 assert.equal(cleanPreview('<@&123456789012345678>'), '@role');
 assert.equal(cleanPreview('see <#123456789012345678>'), 'see #channel');
 assert.equal(cleanPreview('run </config tickets:123456789012345678>'), 'run /config tickets');
});

test('leaves plain text, unicode emoji, and timestamps untouched', () => {
 assert.equal(cleanPreview('Hello 👋 world'), 'Hello 👋 world');
 assert.equal(cleanPreview('<t:1718200000:f>'), '<t:1718200000:f>');
});
