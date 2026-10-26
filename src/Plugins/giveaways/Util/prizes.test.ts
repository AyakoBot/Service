import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planPrizes, type PrizeSlot } from './prizes.js';

const slot = (position: number, winner: string | null = null, claimed = false): PrizeSlot => ({
 position,
 winner,
 claimed,
});

test('planPrizes hands free prizes to winners in list order', () => {
 const plan = planPrizes([slot(1), slot(0), slot(2)], ['a', 'b']);

 assert.deepEqual(plan.release, []);
 assert.deepEqual(plan.assign, [
  { position: 0, winner: 'a' },
  { position: 1, winner: 'b' },
 ]);
});

test('planPrizes passes an unrevealed prize on to the replacement winner', () => {
 const plan = planPrizes([slot(0, 'a'), slot(1, 'b')], ['a', 'c']);

 assert.deepEqual(plan.release, [1]);
 assert.deepEqual(plan.assign, [{ position: 1, winner: 'c' }]);
});

test('planPrizes never hands out a revealed prize again', () => {
 const plan = planPrizes([slot(0, 'a', true), slot(1)], ['c']);

 assert.deepEqual(plan.release, []);
 assert.deepEqual(plan.assign, [{ position: 1, winner: 'c' }]);
});

test('planPrizes leaves a returning winner with the prize they already revealed', () => {
 const plan = planPrizes([slot(0, 'a', true), slot(1)], ['a']);

 assert.deepEqual(plan, { release: [], assign: [] });
});

test('planPrizes assigns only as many prizes as are left', () => {
 const plan = planPrizes([slot(0, 'a', true), slot(1)], ['b', 'c', 'd']);

 assert.deepEqual(plan.assign, [{ position: 1, winner: 'b' }]);
});

test('planPrizes has nothing to do when every winner holds a prize', () => {
 assert.deepEqual(planPrizes([slot(0, 'a'), slot(1, 'b'), slot(2)], ['a', 'b']), {
  release: [],
  assign: [],
 });
});
