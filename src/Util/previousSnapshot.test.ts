import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deserialize, serialize } from '@ayako/utility';

import { previousSnapshot, SNAPSHOT_WRITE_WINDOW_MS } from './previousSnapshot.js';
import type { SnapshotSource } from './previousSnapshot.js';

interface Incoming {
 name: string;
 nick: string;
 noise?: string;
}

interface Snap {
 name: string;
 nick: string;
}

const fresh = (offset = 0): number => Date.now() - offset;

const stale = (): number => Date.now() - SNAPSHOT_WRITE_WINDOW_MS - 1_000;

const defaultProjection = (data: Incoming): Snap | false => ({ name: data.name, nick: data.nick });

const stub = (
 times: number[],
 snapshots: Record<number, Snap | null>,
 projection: (data: Incoming) => Snap | false = defaultProjection,
) => {
 let apiToRCalls = 0;
 const cache: SnapshotSource<Incoming, Snap> = {
  getTimes: async () => [...times],
  getAt: async (time: number) => snapshots[time] ?? null,
  apiToR: (data: Incoming) => {
   apiToRCalls += 1;
   return projection(data);
  },
 };
 return { cache, calls: () => apiToRCalls };
};

test('newest differs from the projected incoming state, so times[0] is the before-state', async () => {
 const [oldest, middle, newest] = [fresh(3_000), fresh(2_000), fresh()];
 const { cache } = stub([oldest, newest, middle], {
  [oldest]: { name: 'oldest', nick: 'c' },
  [middle]: { name: 'middle', nick: 'b' },
  [newest]: { name: 'newest', nick: 'a' },
 });

 assert.deepStrictEqual(
  await previousSnapshot({ cache, ids: ['1', '2'], incoming: { name: 'incoming', nick: 'z' } }),
  { name: 'newest', nick: 'a' },
 );
});

test('newest is the incoming state and was just written, so times[1] is the before-state', async () => {
 const [oldest, previous, newest] = [fresh(3_000), fresh(2_000), fresh()];
 const { cache } = stub([oldest, newest, previous], {
  [oldest]: { name: 'oldest', nick: 'c' },
  [previous]: { name: 'previous', nick: 'b' },
  [newest]: { name: 'same', nick: 'a' },
 });

 assert.deepStrictEqual(
  await previousSnapshot({
   cache,
   ids: ['1'],
   incoming: { name: 'same', nick: 'a', noise: 'churn' },
  }),
  { name: 'previous', nick: 'b' },
 );
});

test('newest matches the incoming state but predates the dispatch, so nothing changed', async () => {
 const [previous, newest] = [stale() - 1_000, stale()];
 const { cache } = stub([newest, previous], {
  [previous]: { name: 'previous', nick: 'b' },
  [newest]: { name: 'same', nick: 'a' },
 });

 assert.deepStrictEqual(
  await previousSnapshot({ cache, ids: ['1'], incoming: { name: 'same', nick: 'a' } }),
  { name: 'same', nick: 'a' },
 );
});

test('a stale newest that differs from the incoming state is still the before-state', async () => {
 const newest = stale();
 const { cache } = stub([newest], { [newest]: { name: 'newest', nick: 'a' } });

 assert.deepStrictEqual(
  await previousSnapshot({ cache, ids: ['1'], incoming: { name: 'incoming', nick: 'z' } }),
  { name: 'newest', nick: 'a' },
 );
});

test('newest is the incoming state and it is the only entry, so there is no before-state', async () => {
 const newest = fresh();
 const { cache } = stub([newest], { [newest]: { name: 'same', nick: 'a' } });

 assert.equal(
  await previousSnapshot({ cache, ids: ['1'], incoming: { name: 'same', nick: 'a' } }),
  null,
 );
});

test('an empty history and a missing newest entry both yield no before-state', async () => {
 const empty = stub([], {});
 assert.equal(
  await previousSnapshot({ cache: empty.cache, ids: ['1'], incoming: { name: 'a', nick: 'b' } }),
  null,
 );

 const [previous, newest] = [fresh(1_000), fresh()];
 const missing = stub([newest, previous], { [previous]: { name: 'previous', nick: 'b' } });
 assert.equal(
  await previousSnapshot({ cache: missing.cache, ids: ['1'], incoming: { name: 'a', nick: 'b' } }),
  null,
 );
});

test('a failed projection yields no before-state instead of the newest snapshot', async () => {
 const [previous, newest] = [fresh(1_000), fresh()];
 const { cache } = stub(
  [newest, previous],
  { [previous]: { name: 'previous', nick: 'b' }, [newest]: { name: 'newest', nick: 'a' } },
  () => false,
 );

 assert.equal(
  await previousSnapshot({ cache, ids: ['1'], incoming: { name: 'incoming', nick: 'z' } }),
  null,
 );
});

test('key insertion order does not affect the comparison and serialisation round-trips', async () => {
 const snap: Snap = { nick: 'a', name: 'same' };
 const [previous, newest] = [fresh(1_000), fresh()];
 const { cache } = stub([newest, previous], {
  [previous]: { name: 'previous', nick: 'b' },
  [newest]: snap,
 });

 assert.deepStrictEqual(
  await previousSnapshot({ cache, ids: ['1'], incoming: { name: 'same', nick: 'a' } }),
  { name: 'previous', nick: 'b' },
 );

 assert.equal(serialize(deserialize(serialize(snap))), serialize(snap));
});

test('a supplied comparator overrides the projection, which is never invoked', async () => {
 const [previous, newest] = [fresh(1_000), fresh()];
 const { cache, calls } = stub([newest, previous], {
  [previous]: { name: 'previous', nick: 'b' },
  [newest]: { name: 'same', nick: 'a' },
 });

 assert.deepStrictEqual(
  await previousSnapshot({
   cache,
   ids: ['1'],
   incoming: { name: 'same', nick: 'a' },
   same: () => false,
  }),
  { name: 'same', nick: 'a' },
 );
 assert.equal(calls(), 0);
});
