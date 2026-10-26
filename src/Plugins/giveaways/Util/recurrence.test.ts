import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextRunAfter } from './recurrence.js';

const hour = 3600000;
const booked = Date.UTC(2026, 9, 16, 18);

test('the next run keeps the booked rhythm when fired on time', () => {
 assert.equal(nextRunAfter(booked, 168 * hour, booked), booked + 168 * hour);
});

test('a late fire does not shift the rhythm', () => {
 assert.equal(nextRunAfter(booked, 24 * hour, booked + 3 * hour), booked + 24 * hour);
});

test('runs missed during downtime are skipped to the next future slot', () => {
 assert.equal(nextRunAfter(booked, 24 * hour, booked + 50 * hour), booked + 72 * hour);
});
