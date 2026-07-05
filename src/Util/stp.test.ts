import assert from 'node:assert/strict';
import { test } from 'node:test';

import stp from './stp.js';

test('interpolates truthy and falsy values', () => {
 assert.equal(stp('{{count}}/{{limit}} components', { count: 0, limit: 24 }), '0/24 components');
 assert.equal(stp('{{flag}}', { flag: false }), 'false');
 assert.equal(stp('a{{empty}}b', { empty: '' }), 'ab');
});

test('leaves unknown placeholders untouched', () => {
 assert.equal(stp('{{missing}}', {}), '{{missing}}');
 assert.equal(stp('{{gone}}', { gone: undefined }), '{{gone}}');
});

test('resolves dotted paths', () => {
 assert.equal(stp('{{a.b.c}}', { a: { b: { c: 'x' } } }), 'x');
});
