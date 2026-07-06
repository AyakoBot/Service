import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDecline, addFlag, declineFlag, hasDeclined, hasFlag, removeFlag } from './guideFlags.js';

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

test('decline bits live above the accept bits and never collide', () => {
 assert.equal(declineFlag(A), 1 << 16);
 assert.equal(declineFlag(B), 1 << 17);
 assert.equal(hasDeclined(addDecline(0, A), A), true);
 assert.equal(hasDeclined(addDecline(0, A), B), false);
 assert.equal(hasFlag(addDecline(0, A), A), false);
});
