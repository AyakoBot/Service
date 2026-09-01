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

test('accepts a hash-prefixed six-digit hex instead of dropping it', () => {
 assert.equal(parseColor('#ff0000'), 0xff0000);
});

test('rejects a partly-hex value instead of truncating to its valid prefix', () => {
 assert.equal(parseColor('ff00zz'), null);
 assert.equal(parseColor('#ff00zz'), null);
});

test('rejects unanchored junk instead of falling back to a colour', () => {
 assert.equal(parseColor('zzz'), null);
 assert.equal(parseColor('zzzza'), null);
 assert.equal(parseColor('ff0000zz'), null);
});
