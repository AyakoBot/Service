import assert from 'node:assert/strict';
import { test } from 'node:test';

import { flatten, messageLink, previewOf } from './text.js';

test('flatten turns newlines and runs of spaces into single spaces', () => {
 assert.equal(flatten(' brb\n\n# loud   header \n'), 'brb # loud header');
});

test('previews stay on one line and stop at 80 characters', () => {
 assert.equal(previewOf('a\nb'), 'a b');
 assert.equal(previewOf(''), '');
 const long = previewOf('x'.repeat(200));
 assert.equal(long.length, 80);
 assert.ok(long.endsWith('…'));
});

test('message links point at the message', () => {
 assert.equal(messageLink('1', '2', '3'), 'https://discord.com/channels/1/2/3');
});
