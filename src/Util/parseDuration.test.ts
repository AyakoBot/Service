import assert from 'node:assert/strict';
import { test } from 'node:test';

import parseDuration from './parseDuration.js';

test('blank and explicit zero parse to 0', () => {
 assert.equal(parseDuration(''), 0);
 assert.equal(parseDuration('   '), 0);
 assert.equal(parseDuration('0'), 0);
 assert.equal(parseDuration('0s'), 0);
});

test('single units parse to milliseconds', () => {
 assert.equal(parseDuration('2h'), 7200000);
 assert.equal(parseDuration('30m'), 1800000);
 assert.equal(parseDuration('1w'), 604800000);
});

test('composite durations sum their parts', () => {
 assert.equal(parseDuration('1h 30m'), 5400000);
 assert.equal(parseDuration('1d 12h'), 129600000);
 assert.equal(parseDuration('2 h'), 7200000);
});

test('unparseable input returns null', () => {
 assert.equal(parseDuration('2hh'), null);
 assert.equal(parseDuration('abc'), null);
 assert.equal(parseDuration('5'), null);
});

test('max caps the result', () => {
 assert.equal(parseDuration('2h', 3600000), 3600000);
 assert.equal(parseDuration('30m', 3600000), 1800000);
});
