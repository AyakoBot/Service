import assert from 'node:assert';
import { test } from 'node:test';

import {
 backoffMs,
 breakerState,
 BreakerState,
 gateToken,
 TokenGate,
 type BreakerEntry,
 type BreakerStore,
} from './tokenBreaker.js';
import { TokenCheckResult } from './tokenCheck.js';

test('backoffMs escalates linearly then caps at one hour', () => {
 assert.strictEqual(backoffMs(1), 5 * 60 * 1000);
 assert.strictEqual(backoffMs(3), 15 * 60 * 1000);
 assert.strictEqual(backoffMs(100), 60 * 60 * 1000);
});

test('breakerState maps entry + now to closed / open / half-open', () => {
 assert.strictEqual(breakerState(null, 1000), BreakerState.Closed);
 assert.strictEqual(breakerState({ n: 1, until: 2000 }, 1000), BreakerState.Open);
 assert.strictEqual(breakerState({ n: 1, until: 2000 }, 2000), BreakerState.HalfOpen);
});

const stubStore = (entry: BreakerEntry | null) => {
 const calls: string[] = [];
 const store: BreakerStore = {
  read: async () => entry,
  open: async (_g, _b, prior, now) => {
   calls.push(`open:${(prior?.n ?? 0) + 1}:${now}`);
  },
  clear: async () => {
   calls.push('clear');
  },
 };
 return { store, calls };
};

test('gate: OPEN entry skips without probing', async () => {
 const { store, calls } = stubStore({ n: 2, until: 5000 });
 let probed = false;
 const gate = await gateToken(store, 'G', 'B', 1000, async () => {
  probed = true;
  return TokenCheckResult.OK;
 });
 assert.strictEqual(gate, TokenGate.Skip);
 assert.strictEqual(probed, false);
 assert.deepStrictEqual(calls, []);
});

test('gate: half-open + OK -> Use and clears the entry', async () => {
 const { store, calls } = stubStore({ n: 2, until: 500 });
 const gate = await gateToken(store, 'G', 'B', 1000, async () => TokenCheckResult.OK);
 assert.strictEqual(gate, TokenGate.Use);
 assert.deepStrictEqual(calls, ['clear']);
});

test('gate: half-open + 10004 -> Skip and opens with n+1', async () => {
 const { store, calls } = stubStore({ n: 2, until: 500 });
 const gate = await gateToken(store, 'G', 'B', 1000, async () => TokenCheckResult.NotInGuild);
 assert.strictEqual(gate, TokenGate.Skip);
 assert.deepStrictEqual(calls, ['open:3:1000']);
});

test('gate: 401 -> Invalid and clears (terminal handoff)', async () => {
 const { store, calls } = stubStore({ n: 1, until: 500 });
 const gate = await gateToken(store, 'G', 'B', 1000, async () => TokenCheckResult.Invalid);
 assert.strictEqual(gate, TokenGate.Invalid);
 assert.deepStrictEqual(calls, ['clear']);
});

test('gate: transient NoAccess -> Skip and leaves the breaker untouched', async () => {
 const { store, calls } = stubStore(null);
 const gate = await gateToken(store, 'G', 'B', 1000, async () => TokenCheckResult.NoAccess);
 assert.strictEqual(gate, TokenGate.Skip);
 assert.deepStrictEqual(calls, []);
});
