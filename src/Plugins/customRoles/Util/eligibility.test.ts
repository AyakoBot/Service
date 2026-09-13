import assert from 'node:assert';
import { test } from 'node:test';

import {
 mergeCapabilities,
 revokeFor,
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

 assert.strictEqual(
  selectAnchorRole(rows, (id) => positions[id] ?? -1),
  'high',
 );
});

test('selectAnchorRole breaks a position tie by row id ascending', () => {
 const rows = [row({ id: 'b2', positionRole: 'X' }), row({ id: 'a1', positionRole: 'Y' })];

 assert.strictEqual(
  selectAnchorRole(rows, () => 5),
  'Y',
 );
});

test('selectAnchorRole ignores rows with no anchor or an unresolvable anchor', () => {
 const rows = [row({ id: 'a', positionRole: null }), row({ id: 'b', positionRole: 'GONE' })];

 assert.strictEqual(
  selectAnchorRole(rows, () => -1),
  null,
 );
 assert.strictEqual(
  selectAnchorRole([row({ id: 'c' })], () => 5),
  null,
 );
});

test('revokeFor revokes only when a customRole-bearing row leaves the set', () => {
 const perk = row({ id: 'a', customRole: true });
 const plain = row({ id: 'b' });

 assert.strictEqual(revokeFor(['a'], [perk, plain], []), true);
 assert.strictEqual(revokeFor(['b'], [perk, plain], []), false);
});

test('revokeFor does not revoke while another customRole row still applies', () => {
 const gone = row({ id: 'a', customRole: true });
 const kept = row({ id: 'b', customRole: true });

 assert.strictEqual(revokeFor(['a'], [gone, kept], [kept]), false);
});

test('revokeFor does not revoke when nothing was lost', () => {
 const perk = row({ id: 'a', customRole: true });

 assert.strictEqual(revokeFor([], [perk], [perk]), false);
 assert.strictEqual(revokeFor([], [perk], []), false);
});

test('revokeFor leaves a role standing when the lost row no longer exists', () => {
 assert.strictEqual(revokeFor(['gone'], [], []), false);
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
