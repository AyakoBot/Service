import assert from 'node:assert/strict';
import { test } from 'node:test';

import draw, { drawWeighted, excluding, planReroll } from './draw.js';

test('draw never picks the same user twice', () => {
 for (let i = 0; i < 50; i += 1) {
  const winners = draw(['1', '2', '3', '4', '5'], 3);
  assert.equal(winners.length, 3);
  assert.equal(new Set(winners).size, 3);
 }
});

test('draw dedupes the pool before drawing', () => {
 const winners = draw(['1', '1', '1', '2'], 3);
 assert.equal(winners.length, 2);
 assert.deepEqual([...winners].sort(), ['1', '2']);
});

test('draw returns the whole pool when count exceeds it', () => {
 assert.deepEqual([...draw(['1', '2'], 5)].sort(), ['1', '2']);
});

test('draw handles empty pool and zero count', () => {
 assert.deepEqual(draw([], 3), []);
 assert.deepEqual(draw(['1'], 0), []);
});

test('draw reaches every entry of the pool', () => {
 const seen = new Set<string>();
 for (let i = 0; i < 500; i += 1) seen.add(draw(['1', '2', '3', '4', '5'], 1)[0]);

 assert.equal(seen.size, 5);
});

test('drawWeighted never picks the same user twice', () => {
 const weights = new Map([
  ['1', 1],
  ['2', 5],
  ['3', 3],
 ]);

 for (let i = 0; i < 50; i += 1) {
  const winners = drawWeighted(weights, 3);
  assert.equal(winners.length, 3);
  assert.equal(new Set(winners).size, 3);
 }
});

test('drawWeighted favours the heavier entry', () => {
 const weights = new Map([
  ['light', 1],
  ['heavy', 99],
 ]);
 let heavyFirst = 0;

 for (let i = 0; i < 1000; i += 1) {
  if (drawWeighted(weights, 1)[0] === 'heavy') heavyFirst += 1;
 }

 assert.ok(heavyFirst > 900, `heavy won ${heavyFirst}/1000`);
});

test('drawWeighted skips zero and negative weights', () => {
 const weights = new Map([
  ['in', 2],
  ['out', 0],
  ['negative', -5],
 ]);

 assert.deepEqual(drawWeighted(weights, 5), ['in']);
 assert.deepEqual(drawWeighted(new Map(), 3), []);
 assert.deepEqual(drawWeighted(weights, 0), []);
});

test('the claim-expiry candidate pool strictly shrinks and terminates', () => {
 const weights = new Map(['a', 'b', 'c', 'd', 'e'].map((id) => [id, 1]));
 const sizes: number[] = [];
 let winners = drawWeighted(weights, 1);
 let forfeited: string[] = [];

 for (let round = 0; round < 20; round += 1) {
  forfeited = [...new Set([...forfeited, ...winners])];
  const candidates = excluding(weights, [...winners, ...forfeited]);
  sizes.push(candidates.size);
  if (!candidates.size) break;

  const fresh = drawWeighted(candidates, winners.length);
  assert.ok(fresh.length >= 1, 'a non-empty candidate map must yield a winner');
  winners = fresh;
 }

 assert.deepEqual(sizes, [4, 3, 2, 1, 0]);
});

test('a bonus-weighted entrant is never dropped to zero weight', () => {
 const roles = ['boost'];
 const snapshot = [
  { role: 'boost', extra: 0 },
  { role: 'other', extra: 5 },
 ];
 const total = snapshot
  .filter((row) => roles.includes(row.role))
  .reduce((sum, row) => sum + Math.floor(Number(row.extra)), 1);

 assert.ok(total >= 1);
 assert.deepEqual(drawWeighted(new Map([['solo', total]]), 1), ['solo']);
});

test('planReroll replaces the chosen number and keeps the rest', () => {
 const plan = planReroll(['a', 'b', 'c'], [], 3, 1);

 assert.equal(plan.kept.length, 2);
 assert.equal(plan.freshCount, 1);
});

test('planReroll drops unclaimed winners before claimed ones', () => {
 for (let i = 0; i < 50; i += 1) {
  const plan = planReroll(['a', 'b', 'c'], ['c'], 3, 1);

  assert.deepEqual([...plan.kept].sort(), ['a', 'b']);
  assert.deepEqual(plan.keptUnclaimed, []);
 }
});

test('planReroll follows a lowered winner count', () => {
 const plan = planReroll(['a', 'b', 'c'], [], 1, 1);

 assert.deepEqual(plan.kept, []);
 assert.equal(plan.freshCount, 1);
});

test('planReroll follows a raised winner count', () => {
 const single = planReroll(['a'], [], 3, 1);
 assert.deepEqual(single.kept, []);
 assert.equal(single.freshCount, 3);

 const pair = planReroll(['a', 'b'], [], 4, 1);
 assert.equal(pair.kept.length, 1);
 assert.equal(pair.freshCount, 3);
});

test('planReroll trims unclaimed winners first when the count shrank', () => {
 for (let i = 0; i < 50; i += 1) {
  const plan = planReroll(['a', 'b', 'c', 'd'], ['c', 'd'], 2, 1);

  assert.equal(plan.kept.length, 1);
  assert.ok(['a', 'b'].includes(plan.kept[0]));
  assert.equal(plan.freshCount, 1);
 }
});
