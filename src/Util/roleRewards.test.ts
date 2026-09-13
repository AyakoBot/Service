import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
 applyingRows,
 denied,
 digestAction,
 DigestAction,
 planDigest,
 type RewardTrigger,
} from './roleRewards.js';

const trigger = (overrides: Partial<RewardTrigger> & { id: string }): RewardTrigger => ({
 active: true,
 roles: [],
 denyRoles: [],
 denyUsers: [],
 ...overrides,
});

describe('applyingRows', () => {
 it('qualifies a member holding any one of the qualifying roles', () => {
  const rows = [trigger({ id: 'a', roles: ['R1', 'R2'] }), trigger({ id: 'b', roles: ['R9'] })];

  assert.deepEqual(
   applyingRows(rows, ['R2'], 'U1').map((r) => r.id),
   ['a'],
  );
 });

 it('skips inactive rows', () => {
  assert.deepEqual(
   applyingRows([trigger({ id: 'a', roles: ['R1'], active: false })], ['R1'], 'U1'),
   [],
  );
 });

 it('skips a row the member matches no role of', () => {
  assert.deepEqual(applyingRows([trigger({ id: 'a', roles: ['R1'] })], ['R9'], 'U1'), []);
 });

 it('rejects a member holding a denied role', () => {
  const rows = [trigger({ id: 'a', roles: ['R1'], denyRoles: ['BAD'] })];

  assert.deepEqual(applyingRows(rows, ['R1', 'BAD'], 'U1'), []);
  assert.deepEqual(
   applyingRows(rows, ['R1'], 'U1').map((r) => r.id),
   ['a'],
  );
 });

 it('rejects a denied user even while holding a qualifying role', () => {
  const rows = [trigger({ id: 'a', roles: ['R1'], denyUsers: ['U1'] })];

  assert.deepEqual(applyingRows(rows, ['R1'], 'U1'), []);
  assert.deepEqual(
   applyingRows(rows, ['R1'], 'U2').map((r) => r.id),
   ['a'],
  );
 });
});

describe('denied', () => {
 it('refuses a claimant listed by user id', () => {
  assert.equal(denied([trigger({ id: 'a', denyUsers: ['U1'] })], [], 'U1'), true);
 });

 it('refuses a claimant holding a denied role', () => {
  assert.equal(denied([trigger({ id: 'b', denyRoles: ['BAD'] })], ['BAD'], 'U2'), true);
 });

 it('passes a claimant on neither deny list', () => {
  const rows = [trigger({ id: 'a', denyUsers: ['U1'] }), trigger({ id: 'b', denyRoles: ['BAD'] })];

  assert.equal(denied(rows, ['GOOD'], 'U2'), false);
  assert.equal(denied([], ['BAD'], 'U1'), false);
 });
});

describe('digestAction', () => {
 it('seeds on a never-observed member', () => {
  assert.equal(digestAction([], null), DigestAction.Seed);
  assert.equal(digestAction(['a'], null), DigestAction.Seed);
 });

 it('reports Unchanged for an equal set regardless of order', () => {
  assert.equal(digestAction(['a'], ['a']), DigestAction.Unchanged);
  assert.equal(digestAction(['a', 'b'], ['b', 'a']), DigestAction.Unchanged);
  assert.equal(digestAction([], []), DigestAction.Unchanged);
 });

 it('reports Changed on any membership difference', () => {
  assert.equal(digestAction(['a'], ['b']), DigestAction.Changed);
  assert.equal(digestAction(['a', 'b'], ['a']), DigestAction.Changed);
  assert.equal(digestAction(['a'], ['a', 'b']), DigestAction.Changed);
 });
});

describe('planDigest', () => {
 it('seeds a never-observed member with no payout, writing only when rewards exist', () => {
  const paying = planDigest([trigger({ id: 'a' })], null);

  assert.equal(paying.action, DigestAction.Seed);
  assert.deepEqual(paying.rewards, ['a']);
  assert.deepEqual(paying.gained, []);
  assert.deepEqual(paying.lost, []);
  assert.equal(paying.write, true);

  const empty = planDigest([], null);

  assert.equal(empty.action, DigestAction.Seed);
  assert.deepEqual(empty.rewards, []);
  assert.deepEqual(empty.gained, []);
  assert.deepEqual(empty.lost, []);
  assert.equal(empty.write, false);
 });

 it('computes gained and lost against the stored digest', () => {
  const plan = planDigest([trigger({ id: 'a' }), trigger({ id: 'c' })], ['a', 'b']);

  assert.equal(plan.action, DigestAction.Changed);
  assert.deepEqual(plan.rewards, ['a', 'c']);
  assert.deepEqual(plan.gained, ['c']);
  assert.deepEqual(plan.lost, ['b']);
  assert.equal(plan.write, true);
 });

 it('returns Unchanged without writing for a member whose reward set held', () => {
  const plan = planDigest([trigger({ id: 'a' }), trigger({ id: 'b' })], ['b', 'a']);

  assert.equal(plan.action, DigestAction.Unchanged);
  assert.deepEqual(plan.gained, []);
  assert.deepEqual(plan.lost, []);
  assert.equal(plan.write, false);
 });

 it('is idempotent against a replayed member update', () => {
  const rows = [trigger({ id: 'a' })];
  const first = planDigest(rows, ['b']);
  const replay = planDigest(rows, first.rewards);

  assert.equal(first.action, DigestAction.Changed);
  assert.deepEqual(first.lost, ['b']);
  assert.equal(replay.action, DigestAction.Unchanged);
  assert.equal(replay.write, false);
 });
});
