import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseColor } from './parseColor.js';

test('parses hex colors with and without the hash', () => {
 assert.equal(parseColor('#5865F2'), 0x5865f2);
 assert.equal(parseColor('5865f2'), 0x5865f2);
 assert.equal(parseColor(' #FFFFFF '), 0xffffff);
});

test('rejects non-hex input', () => {
 assert.equal(parseColor('xyz'), null);
 assert.equal(parseColor('#fff'), null);
 assert.equal(parseColor(''), null);
});
