import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import parseDuration from '../../../Util/parseDuration.js';

import remindPrefill from './remindPrefill.js';

const now = Date.UTC(2026, 9, 28, 12, 0, 0);
const hour = 3600000;
const at = (offset: number) => new Date(now + offset);

describe('remindPrefill', () => {
 it('stops one hour before the end', () => {
  assert.equal(remindPrefill(at(7 * 24 * hour), now), '6d 23h');
 });

 it('rounds down to whole minutes', () => {
  assert.equal(remindPrefill(at(hour + 30 * 60000 + 45000), now), '30m');
 });

 it('offers nothing within the last hour', () => {
  assert.equal(remindPrefill(at(hour), now), null);
  assert.equal(remindPrefill(at(-hour), now), null);
 });

 it('reads back through parseDuration', () => {
  const prefill = remindPrefill(at(8 * 24 * hour + 90 * 60000), now);
  assert.equal(parseDuration(prefill ?? ''), 8 * 24 * hour + 30 * 60000);
 });
});
