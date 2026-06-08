import assert from 'node:assert/strict';
import { test } from 'node:test';

import formatDuration from './formatDuration.js';

test('formats single units', () => {
 assert.equal(formatDuration(7200000), '2h');
 assert.equal(formatDuration(1800000), '30m');
 assert.equal(formatDuration(604800000), '1w');
});

test('formats composite durations', () => {
 assert.equal(formatDuration(5400000), '1h 30m');
 assert.equal(formatDuration(129600000), '1d 12h');
});

test('zero and negative format to an empty string', () => {
 assert.equal(formatDuration(0), '');
 assert.equal(formatDuration(-1000), '');
});
