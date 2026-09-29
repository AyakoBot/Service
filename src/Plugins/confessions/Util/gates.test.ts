import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConfessionAnonymity } from '@ayako/database';

import {
 GateFailure,
 banIsActive,
 checkGates,
 contentLimit,
 lengthBounds,
 snowflakeCreatedAt,
 type GateInput,
} from './gates.js';
import {
 IdentityError,
 authorFor,
 canReveal,
 deriveIdentity,
 isAuthorOf,
} from './identity.js';

const now = 1_800_000_000_000;

const clean = (over: Partial<GateInput> = {}): GateInput => ({
 now,
 banned: false,
 blocked: false,
 accountCreated: now - 86_400_000,
 memberJoined: now - 86_400_000,
 minAccountAge: 0,
 minMemberAge: 0,
 onCooldown: false,
 length: 50,
 minLength: 10,
 maxLength: 4000,
 recentCount: 0,
 maxPerDay: 0,
 mediaValid: true,
 ...over,
});

describe('confessions gates', () => {
 it('passes a clean submission', () => {
  assert.equal(checkGates(clean()), null);
 });

 it('rejects a banned user before evaluating the cooldown', () => {
  assert.equal(checkGates(clean({ banned: true, onCooldown: true })), GateFailure.Banned);
 });

 it('rejects a blocked user before age checks', () => {
  const input = clean({ blocked: true, minAccountAge: 999_999, accountCreated: now });
  assert.equal(checkGates(input), GateFailure.Blocked);
 });

 it('enforces account and membership age only when configured', () => {
  assert.equal(checkGates(clean({ accountCreated: now })), null);
  assert.equal(
   checkGates(clean({ accountCreated: now, minAccountAge: 60 })),
   GateFailure.AccountTooNew,
  );
  assert.equal(
   checkGates(clean({ memberJoined: now, minMemberAge: 60 })),
   GateFailure.MemberTooNew,
  );
 });

 it('enforces length bounds', () => {
  assert.equal(checkGates(clean({ length: 3 })), GateFailure.TooShort);
  assert.equal(checkGates(clean({ length: 9999 })), GateFailure.TooLong);
 });

 it('treats maxPerDay of 0 as unlimited', () => {
  assert.equal(checkGates(clean({ recentCount: 500 })), null);
  assert.equal(checkGates(clean({ recentCount: 3, maxPerDay: 3 })), GateFailure.DailyLimit);
  assert.equal(checkGates(clean({ recentCount: 2, maxPerDay: 3 })), null);
 });
});

describe('confessions ban expiry', () => {
 it('treats a null until as permanent', () => {
  assert.equal(banIsActive({ until: null }, now), true);
 });

 it('does not block once until has passed', () => {
  assert.equal(banIsActive({ until: new Date(now - 1000) }, now), false);
  assert.equal(banIsActive({ until: new Date(now + 1000) }, now), true);
 });

 it('treats a missing ban row as not banned', () => {
  assert.equal(banIsActive(null, now), false);
 });
});

describe('confessions identity', () => {
 const secret = 'test-secret';

 it('fingerprints the member the same way whatever the anonymity mode', () => {
  const id = deriveIdentity('g1', 'u1', secret);

  assert.notEqual(id, 'u1');
  assert.equal(id.length, 64);
 });

 it('keeps the plain author and reveal only in hidden mode', () => {
  assert.equal(authorFor(ConfessionAnonymity.Unmaskable, 'u1'), 'u1');
  assert.equal(authorFor(ConfessionAnonymity.Anonymous, 'u1'), null);
  assert.equal(canReveal(ConfessionAnonymity.Unmaskable), true);
  assert.equal(canReveal(ConfessionAnonymity.Anonymous), false);
 });

 it('is stable for the same member and differs across guilds and members', () => {
  const a = deriveIdentity('g1', 'u1', secret);

  assert.equal(a, deriveIdentity('g1', 'u1', secret));
  assert.notEqual(a, deriveIdentity('g2', 'u1', secret));
  assert.notEqual(a, deriveIdentity('g1', 'u2', secret));
 });

 it('fails closed when the secret is missing', () => {
  assert.throws(
   () => deriveIdentity('g1', 'u1', undefined),
   new RegExp(IdentityError.SecretMissing),
  );
 });

 it('recognises an author by fingerprint, legacy plain identity or stored author', () => {
  const mine = deriveIdentity('g1', 'u1', secret);
  const theirs = deriveIdentity('g1', 'u2', secret);

  assert.equal(isAuthorOf({ identity: mine, author: null }, mine, 'u1'), true);
  assert.equal(isAuthorOf({ identity: 'u1', author: null }, mine, 'u1'), true);
  assert.equal(isAuthorOf({ identity: 'legacy', author: 'u1' }, mine, 'u1'), true);
  assert.equal(isAuthorOf({ identity: mine, author: 'u1' }, theirs, 'u2'), false);
 });
});

describe('confessions snowflake', () => {
 it('decodes a known snowflake to its creation time', () => {
  assert.equal(snowflakeCreatedAt('175928847299117063'), 1462015105796);
 });
});

describe('confessions length bounds', () => {
 it('caps the maximum at the content limit', () => {
  assert.deepEqual(lengthBounds(10, 4000), { min: 10, max: contentLimit });
 });

 it('never lets the minimum exceed the maximum or drop below one', () => {
  assert.deepEqual(lengthBounds(500, 100), { min: 100, max: 100 });
  assert.deepEqual(lengthBounds(0, 0), { min: 1, max: 1 });
  assert.deepEqual(lengthBounds(-5, 9999), { min: 1, max: contentLimit });
 });

 it('falls back to safe bounds for non-numbers', () => {
  assert.deepEqual(lengthBounds(Number.NaN, Number.NaN), { min: 1, max: contentLimit });
 });
});

describe('confessions media gate', () => {
 it('rejects an invalid image link after the length checks', () => {
  assert.equal(checkGates(clean({ mediaValid: false })), GateFailure.InvalidMedia);
  assert.equal(checkGates(clean({ mediaValid: false, length: 3 })), GateFailure.TooShort);
 });
});
