import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
 decodeThreadData,
 encodeThreadData,
 oldestTracked,
 threadIdOfKey,
 threadKeyOf,
 type TrackedThread,
} from './notifThread.js';

const prefix = 'moderation:notifthread:';

const entry = (channelId: string, armedAt: number, threadId: string): TrackedThread => ({
 key: threadKeyOf(prefix, threadId),
 threadId,
 guildId: 'g',
 channelId,
 userId: 'u',
 armedAt,
});

describe('notifThread', () => {
 it('round-trips a thread id through its prefix', () => {
  assert.equal(threadKeyOf(prefix, '123'), 'moderation:notifthread:123');
  assert.equal(threadIdOfKey(prefix, threadKeyOf(prefix, '123')), '123');
 });

 it('round-trips thread data with a pinned timestamp', () => {
  assert.deepEqual(decodeThreadData(encodeThreadData('g', 'c', 'u', 42)), {
   guildId: 'g',
   channelId: 'c',
   userId: 'u',
   armedAt: 42,
  });
 });

 it('refuses incomplete data', () => {
  assert.equal(decodeThreadData(''), null);
  assert.equal(decodeThreadData('g:c'), null);
  assert.equal(decodeThreadData('g::u:42'), null);
 });

 it('defaults an unparseable timestamp to zero', () => {
  assert.equal(decodeThreadData('g:c:u:nope')?.armedAt, 0);
 });

 it('picks the oldest entry for the channel and ignores other channels', () => {
  const tracked = [entry('c1', 300, 't1'), entry('c1', 100, 't2'), entry('c2', 1, 't3')];

  assert.equal(oldestTracked(tracked, 'c1')?.threadId, 't2');
  assert.equal(oldestTracked(tracked, 'c3'), null);
 });

 it('returns null for an empty tracking set', () => {
  assert.equal(oldestTracked([], 'c1'), null);
 });
});
