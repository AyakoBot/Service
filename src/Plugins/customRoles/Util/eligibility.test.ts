import assert from 'node:assert';
import { test } from 'node:test';

import {
 applyingRows,
 denied,
 digestAction,
 DigestAction,
 mergeCapabilities,
 planDigest,
 selectAnchorRole,
 truncateShared,
 type RewardRowLike,
} from './eligibility.js';

const row = (overrides: Partial<RewardRowLike> & { id: string }): RewardRowLike => ({
 active: true,
 roles: [],
 denyRoles: [],
 denyUsers: [],
 customRole: false,
 canSetColor: false,
 canSetIcon: false,
 canSetGradient: false,
 canSetHolo: false,
 positionRole: null,
 maxShare: 0,
 ...overrides,
});

test('applyingRows qualifies a member holding any one of the qualifying roles', () => {
 const rows = [row({ id: 'a', roles: ['R1', 'R2'] }), row({ id: 'b', roles: ['R9'] })];

 assert.deepStrictEqual(
  applyingRows(rows, ['R2'], 'U1').map((r) => r.id),
  ['a'],
 );
});

test('applyingRows skips inactive rows', () => {
 const rows = [row({ id: 'a', roles: ['R1'], active: false })];

 assert.deepStrictEqual(applyingRows(rows, ['R1'], 'U1'), []);
});

test('applyingRows rejects a member holding a denied role', () => {
 const rows = [row({ id: 'a', roles: ['R1'], denyRoles: ['BAD'] })];

 assert.deepStrictEqual(applyingRows(rows, ['R1', 'BAD'], 'U1'), []);
 assert.deepStrictEqual(
  applyingRows(rows, ['R1'], 'U1').map((r) => r.id),
  ['a'],
 );
});

test('applyingRows rejects a denied user even while holding a qualifying role', () => {
 const rows = [row({ id: 'a', roles: ['R1'], denyUsers: ['U1'] })];

 assert.deepStrictEqual(applyingRows(rows, ['R1'], 'U1'), []);
 assert.deepStrictEqual(
  applyingRows(rows, ['R1'], 'U2').map((r) => r.id),
  ['a'],
 );
});

test('mergeCapabilities unions every capability across applying rows', () => {
 const capabilities = mergeCapabilities([
  row({ id: 'a', customRole: true, canSetIcon: true }),
  row({ id: 'b', canSetColor: true }),
 ]);

 assert.deepStrictEqual(capabilities, {
  customRole: true,
  canSetColor: true,
  canSetIcon: true,
  canSetGradient: false,
  canSetHolo: false,
  maxShare: 0,
 });
});

test('mergeCapabilities takes the max of maxShare, never the sum', () => {
 assert.strictEqual(
  mergeCapabilities([row({ id: 'a', maxShare: 3 }), row({ id: 'b', maxShare: 7 })]).maxShare,
  7,
 );
});

test('mergeCapabilities guards an empty applying set so maxShare is 0, never -Infinity', () => {
 const capabilities = mergeCapabilities([]);

 assert.strictEqual(capabilities.maxShare, 0);
 assert.strictEqual(Number.isFinite(capabilities.maxShare), true);
 assert.strictEqual(capabilities.customRole, false);
});

test('selectAnchorRole picks the anchor resolving to the highest cached position', () => {
 const positions: Record<string, number> = { low: 2, high: 9 };
 const rows = [row({ id: 'a', positionRole: 'low' }), row({ id: 'b', positionRole: 'high' })];

 assert.strictEqual(selectAnchorRole(rows, (id) => positions[id] ?? -1), 'high');
});

test('selectAnchorRole breaks a position tie by row id ascending', () => {
 const rows = [row({ id: 'b2', positionRole: 'X' }), row({ id: 'a1', positionRole: 'Y' })];

 assert.strictEqual(selectAnchorRole(rows, () => 5), 'Y');
});

test('selectAnchorRole ignores rows with no anchor or an unresolvable anchor', () => {
 const rows = [row({ id: 'a', positionRole: null }), row({ id: 'b', positionRole: 'GONE' })];

 assert.strictEqual(
  selectAnchorRole(rows, () => -1),
  null,
 );
 assert.strictEqual(selectAnchorRole([row({ id: 'c' })], () => 5), null);
});

test('digestAction seeds on a never-observed member and pays out nothing', () => {
 const plan = planDigest([row({ id: 'a', customRole: true })], null, []);

 assert.strictEqual(plan.action, DigestAction.Seed);
 assert.deepStrictEqual(plan.gained, []);
 assert.deepStrictEqual(plan.lost, []);
 assert.strictEqual(plan.revoke, false);
 assert.strictEqual(plan.write, true);
 assert.deepStrictEqual(plan.rewards, ['a']);
});

test('planDigest seeds without writing when a never-observed member qualifies for nothing', () => {
 const plan = planDigest([], null, []);

 assert.strictEqual(plan.action, DigestAction.Seed);
 assert.strictEqual(plan.write, false);
 assert.deepStrictEqual(plan.rewards, []);
});

test('planDigest returns Unchanged for a nickname/avatar/timeout update', () => {
 const rows = [row({ id: 'a', customRole: true }), row({ id: 'b' })];
 const plan = planDigest(rows, ['b', 'a'], rows);

 assert.strictEqual(plan.action, DigestAction.Unchanged);
 assert.strictEqual(plan.write, false);
 assert.strictEqual(plan.revoke, false);
 assert.deepStrictEqual(plan.gained, []);
 assert.deepStrictEqual(plan.lost, []);
});

test('planDigest computes gained and lost against the stored digest', () => {
 const all = [row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' })];
 const plan = planDigest([all[0], all[2]], ['a', 'b'], all);

 assert.strictEqual(plan.action, DigestAction.Changed);
 assert.deepStrictEqual(plan.gained, ['c']);
 assert.deepStrictEqual(plan.lost, ['b']);
 assert.strictEqual(plan.write, true);
});

test('planDigest is idempotent against a re-reported member update', () => {
 const all = [row({ id: 'a' })];
 const first = planDigest(all, ['b'], [...all, row({ id: 'b' })]);
 const replay = planDigest(all, first.rewards, [...all, row({ id: 'b' })]);

 assert.strictEqual(first.action, DigestAction.Changed);
 assert.strictEqual(replay.action, DigestAction.Unchanged);
 assert.strictEqual(replay.write, false);
});

test('planDigest revokes only when a customRole-bearing row leaves the set', () => {
 const perk = row({ id: 'a', customRole: true });
 const plain = row({ id: 'b' });

 assert.strictEqual(planDigest([], ['a'], [perk, plain]).revoke, true);
 assert.strictEqual(planDigest([], ['b'], [perk, plain]).revoke, false);
});

test('planDigest does not revoke while another customRole row still applies', () => {
 const gone = row({ id: 'a', customRole: true });
 const kept = row({ id: 'b', customRole: true });

 assert.strictEqual(planDigest([kept], ['a', 'b'], [gone, kept]).revoke, false);
});

test('planDigest does not revoke on a purely gained change', () => {
 const perk = row({ id: 'a', customRole: true });

 assert.strictEqual(planDigest([perk], [], [perk]).revoke, false);
});

test('planDigest leaves a role standing when the lost row no longer exists', () => {
 assert.strictEqual(planDigest([], ['gone'], []).revoke, false);
});

test('digestAction is the exported discriminant planDigest reports', () => {
 assert.strictEqual(digestAction([], null), DigestAction.Seed);
 assert.strictEqual(digestAction(['a'], ['a']), DigestAction.Unchanged);
 assert.strictEqual(digestAction(['a'], ['b']), DigestAction.Changed);
});

test('truncateShared keeps the head and drops the tail past the cap', () => {
 assert.deepStrictEqual(truncateShared(['u1', 'u2', 'u3'], 2), {
  kept: ['u1', 'u2'],
  dropped: ['u3'],
 });
});

test('truncateShared drops everything at a cap of zero and nothing below the cap', () => {
 assert.deepStrictEqual(truncateShared(['u1'], 0), { kept: [], dropped: ['u1'] });
 assert.deepStrictEqual(truncateShared(['u1'], 5), { kept: ['u1'], dropped: [] });
});

test('denied refuses a claimant listed by user id or holding a denied role', () => {
 const rows = [row({ id: 'a', denyUsers: ['U1'] }), row({ id: 'b', denyRoles: ['BAD'] })];

 assert.strictEqual(denied(rows, [], 'U1'), true);
 assert.strictEqual(denied(rows, ['BAD'], 'U2'), true);
 assert.strictEqual(denied(rows, ['GOOD'], 'U2'), false);
 assert.strictEqual(denied([], ['BAD'], 'U1'), false);
});
