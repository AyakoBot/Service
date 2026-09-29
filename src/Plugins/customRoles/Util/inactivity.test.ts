import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ActivitySource } from '@ayako/database';

import {
 coverageStart,
 dayMs,
 inactiveUnder,
 shouldWipe,
 watchWindow,
 type RewardPolicy,
} from './inactivity.js';

const now = 1_800_000_000_000;
const threshold = 30 * dayMs;
const ago = (days: number): Date => new Date(now - days * dayMs);

const policy = (over: Partial<RewardPolicy> = {}): RewardPolicy => ({
 wipe: true,
 sources: [ActivitySource.Messages],
 threshold,
 since: now - 90 * dayMs,
 trackingSince: now - 90 * dayMs,
 ...over,
});
const activity = (entries: [ActivitySource, Date][]) =>
 new Map(entries.map(([source, at]) => [source as string, at.getTime()]));

describe('custom role inactivity per reward', () => {
 it('counts a member inactive only past the threshold on the reward sources', () => {
  assert.equal(inactiveUnder(policy(), activity([[ActivitySource.Messages, ago(31)]]), now), true);
  assert.equal(inactiveUnder(policy(), activity([[ActivitySource.Messages, ago(2)]]), now), false);
 });

 it('ignores activity of a type the reward does not count', () => {
  const voiceOnly = activity([[ActivitySource.Voice, ago(1)]]);

  assert.equal(inactiveUnder(policy(), voiceOnly, now), true);
  assert.equal(inactiveUnder(policy({ sources: [ActivitySource.Voice] }), voiceOnly, now), false);
 });

 it('dates a member without records to the tracking start', () => {
  assert.equal(inactiveUnder(policy({ trackingSince: ago(20).getTime() }), new Map(), now), false);
  assert.equal(inactiveUnder(policy({ trackingSince: ago(40).getTime() }), new Map(), now), true);
 });

 it('never counts anyone inactive when wiping is off, coverage is short, or the threshold is under a day', () => {
  const idle = activity([[ActivitySource.Messages, ago(200)]]);

  assert.equal(inactiveUnder(policy({ wipe: false }), idle, now), false);
  assert.equal(inactiveUnder(policy({ since: ago(10).getTime() }), idle, now), false);
  assert.equal(inactiveUnder(policy({ threshold: dayMs - 1 }), idle, now), false);
 });

 it('wipes only when every granting reward agrees', () => {
  const idle = activity([[ActivitySource.Messages, ago(40)]]);

  assert.equal(shouldWipe([policy(), policy({ threshold: 35 * dayMs })], idle, now), true);
  assert.equal(shouldWipe([policy(), policy({ wipe: false })], idle, now), false);
  assert.equal(shouldWipe([policy(), policy({ threshold: 60 * dayMs })], idle, now), false);
  assert.equal(shouldWipe([], idle, now), false);
 });
});

describe('custom role activity watch window', () => {
 const tolerance = 3 * 3_600_000;

 it('keeps the observed start while the heartbeat is fresh', () => {
  assert.deepEqual(watchWindow(now - 3_600_000, now - 50 * dayMs, now, tolerance), {
   since: now - 50 * dayMs,
   reset: false,
  });
 });

 it('restarts the observed window after downtime or on first run', () => {
  assert.deepEqual(watchWindow(now - 10 * dayMs, now - 50 * dayMs, now, tolerance), {
   since: now,
   reset: true,
  });
  assert.deepEqual(watchWindow(0, 0, now, tolerance), { since: now, reset: true });
 });
});

describe('custom role inactivity coverage', () => {
 const base = {
  now,
  serviceSince: now - 90 * dayMs,
  trackingSince: now - 60 * dayMs,
  observedAt: now - dayMs,
  countsOnline: false,
  presenceBeat: 0,
  presenceSince: 0,
  presenceTolerance: dayMs,
 };

 it('starts at the later of service uptime and guild tracking', () => {
  assert.equal(coverageStart(base), now - 60 * dayMs);
  assert.equal(coverageStart({ ...base, serviceSince: now - 5 * dayMs }), now - 5 * dayMs);
 });

 it('covers nothing until real activity was recorded since tracking began', () => {
  assert.equal(coverageStart({ ...base, observedAt: 0 }), now);
  assert.equal(coverageStart({ ...base, observedAt: now - 60 * dayMs }), now);
 });

 it('covers nothing for online-counting guilds while presence updates do not arrive', () => {
  assert.equal(coverageStart({ ...base, countsOnline: true }), now);
  assert.equal(
   coverageStart({ ...base, countsOnline: true, presenceBeat: now - 2 * dayMs, presenceSince: now - 80 * dayMs }),
   now,
  );
 });

 it('starts at presence flow for online-counting guilds once presences arrive', () => {
  assert.equal(
   coverageStart({ ...base, countsOnline: true, presenceBeat: now - 60_000, presenceSince: now - 10 * dayMs }),
   now - 10 * dayMs,
  );
 });
});
