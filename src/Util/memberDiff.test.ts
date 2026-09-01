import assert from 'node:assert';
import { test } from 'node:test';

import type { RMember } from '@ayako/utility';
import type {
 APIGuildMember,
 APIUser,
 GatewayGuildMemberUpdateDispatchData,
} from 'discord-api-types/v10';

import type Client from '../Classes/Client.js';

import {
 memberDelta,
 memberProjectionSnapshot,
 previousSnapshotTime,
 sortTimesDescending,
} from './memberDiff.js';
import { SNAPSHOT_WRITE_WINDOW_MS } from './previousSnapshot.js';

const boostedAt = '2026-07-30T00:00:00.000+00:00';

test('sortTimesDescending orders an unordered hvals result numerically, newest first', () => {
 assert.deepStrictEqual(sortTimesDescending([3, 100, 20]), [100, 20, 3]);
 assert.deepStrictEqual(sortTimesDescending([9, 100]), [100, 9]);
 assert.deepStrictEqual(sortTimesDescending([]), []);
});

test('sortTimesDescending does not mutate its input', () => {
 const times = [3, 100, 20];
 sortTimesDescending(times);
 assert.deepStrictEqual(times, [3, 100, 20]);
});

test('previousSnapshotTime returns null when the member has no history', () => {
 assert.strictEqual(previousSnapshotTime([], null, { roles: ['A'] }), null);
});

test('previousSnapshotTime returns null when the newest snapshot is a cache miss', () => {
 assert.strictEqual(previousSnapshotTime([200, 100], null, { roles: ['A'] }), null);
});

test('previousSnapshotTime uses the newest snapshot when it differs from the payload', () => {
 assert.strictEqual(previousSnapshotTime([200, 100], { roles: ['A'] }, { roles: ['A', 'B'] }), 200);
});

test('previousSnapshotTime falls back to the second snapshot when the newest is the new state', () => {
 assert.strictEqual(
  previousSnapshotTime([200, 100], { roles: ['B', 'A'] }, { roles: ['A', 'B'] }),
  100,
 );
});

test('previousSnapshotTime returns null for a single-snapshot member already at the new state', () => {
 assert.strictEqual(previousSnapshotTime([200], { roles: ['A'] }, { roles: ['A'] }), null);
});

test('previousSnapshotTime treats an absent premium_since as null', () => {
 assert.strictEqual(
  previousSnapshotTime([200, 100], { roles: ['A'] }, { roles: ['A'], premium_since: null }),
  100,
 );
});

test('previousSnapshotTime keeps the newest snapshot when only the boost state differs', () => {
 assert.strictEqual(
  previousSnapshotTime([200, 100], { roles: ['A'] }, { roles: ['A'], premium_since: boostedAt }),
  200,
 );
});

test('memberDelta derives added and removed roles', () => {
 const delta = memberDelta({ roles: ['A', 'B'] }, { roles: ['B', 'C'] });

 assert.deepStrictEqual(delta.addedRoles, ['C']);
 assert.deepStrictEqual(delta.removedRoles, ['A']);
 assert.strictEqual(delta.rolesChanged, true);
});

test('memberDelta reports rolesChanged false for a nickname-only update', () => {
 const delta = memberDelta({ roles: ['A', 'B'] }, { roles: ['A', 'B'] });

 assert.deepStrictEqual(delta.addedRoles, []);
 assert.deepStrictEqual(delta.removedRoles, []);
 assert.strictEqual(delta.rolesChanged, false);
});

test('memberDelta detects a boost start and a boost end', () => {
 const started = memberDelta({ roles: [] }, { roles: [], premium_since: boostedAt });
 const ended = memberDelta({ roles: [], premium_since: boostedAt }, { roles: [] });

 assert.strictEqual(started.boostStarted, true);
 assert.strictEqual(started.boostEnded, false);
 assert.strictEqual(ended.boostStarted, false);
 assert.strictEqual(ended.boostEnded, true);
});

test('memberDelta reports no boost transition while the boost is merely held', () => {
 const delta = memberDelta(
  { roles: [], premium_since: boostedAt },
  { roles: [], premium_since: boostedAt },
 );

 assert.strictEqual(delta.boostStarted, false);
 assert.strictEqual(delta.boostEnded, false);
});

test('memberDelta is a no-op when there is no previous snapshot', () => {
 const delta = memberDelta(null, { roles: ['A', 'B'], premium_since: boostedAt });

 assert.deepStrictEqual(delta, {
  addedRoles: [],
  removedRoles: [],
  rolesChanged: false,
  boostStarted: false,
  boostEnded: false,
 });
});

const projection = (over: Partial<RMember> = {}): RMember =>
 ({
  user_id: 'U',
  guild_id: 'G',
  nick: null,
  avatar_url: null,
  banner_url: null,
  roles: [],
  joined_at: '2026-01-01T00:00:00.000Z',
  premium_since: null,
  deaf: false,
  mute: false,
  flags: 0,
  pending: false,
  avatar_decoration_data: null,
  communication_disabled_until: null,
  ...over,
 }) as RMember;

const stubClient = (snapshots: Record<number, RMember>): Client =>
 ({
  cache: {
   members: {
    getTimes: async () => Object.keys(snapshots).map(Number),
    getAt: async (time: number) => snapshots[time] ?? null,
    apiToR: (data: APIGuildMember) =>
     projection({
      nick: data.nick ?? null,
      roles: data.roles,
      joined_at: data.joined_at,
      deaf: data.deaf,
      mute: data.mute,
      flags: data.flags,
     }),
   },
  },
 }) as unknown as Client;

const dispatch = (
 over: Partial<GatewayGuildMemberUpdateDispatchData>,
): GatewayGuildMemberUpdateDispatchData =>
 ({
  guild_id: 'G',
  user: { id: 'U' } as APIUser,
  roles: [],
  joined_at: '2026-01-01T00:00:00.000Z',
  ...over,
 }) as GatewayGuildMemberUpdateDispatchData;

test('memberProjectionSnapshot keeps the newest snapshot on a nickname-only change', async () => {
 const client = stubClient({
  [Date.now()]: projection({ nick: 'old' }),
  [Date.now() - 1_000]: projection({ nick: 'older' }),
 });
 const previous = await memberProjectionSnapshot.call(client, dispatch({ nick: 'new' }));

 assert.strictEqual(previous?.nick, 'old');
});

test('memberProjectionSnapshot ignores joined_at and falls back to the second snapshot', async () => {
 const client = stubClient({
  [Date.now()]: projection({ joined_at: '2026-02-02T00:00:00.000Z' }),
  [Date.now() - 1_000]: projection({ joined_at: '2026-03-03T00:00:00.000Z' }),
 });
 const previous = await memberProjectionSnapshot.call(
  client,
  dispatch({ joined_at: '2026-04-04T00:00:00.000Z' }),
 );

 assert.strictEqual(previous?.joined_at, '2026-03-03T00:00:00.000Z');
});

test('memberProjectionSnapshot ignores a projection older than the dispatch that carried it', async () => {
 const client = stubClient({
  [Date.now() - SNAPSHOT_WRITE_WINDOW_MS - 1_000]: projection({ nick: 'unchanged' }),
  [Date.now() - SNAPSHOT_WRITE_WINDOW_MS - 2_000]: projection({ nick: 'older' }),
 });
 const previous = await memberProjectionSnapshot.call(client, dispatch({ nick: 'unchanged' }));

 assert.strictEqual(previous?.nick, 'unchanged');
});
