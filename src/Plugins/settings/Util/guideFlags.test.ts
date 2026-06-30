import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addFlag, hasFlag, removeFlag } from './guideFlags.js';

const A = 1 << 0;
const B = 1 << 1;

test('addFlag sets a bit idempotently', () => {
 assert.equal(addFlag(0, A), 1);
 assert.equal(addFlag(A, A), 1);
 assert.equal(addFlag(A, B), 3);
});

test('hasFlag detects a set bit', () => {
 assert.equal(hasFlag(3, A), true);
 assert.equal(hasFlag(2, A), false);
});

test('removeFlag clears a bit', () => {
 assert.equal(removeFlag(3, A), 2);
 assert.equal(removeFlag(2, A), 2);
});
