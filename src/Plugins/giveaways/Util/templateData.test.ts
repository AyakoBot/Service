import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GiveawayEnforcement, type GiveawayTemplate } from '@ayako/database';

import { GiveawayErrors } from '../Classes/DBGiveaway.js';
import { GiveawayOption } from '../Classes/Routes.js';

import type { GiveawayDefaults } from './giveawayDefaults.js';
import { templateOverrides, templatePlan, withDefaults } from './templateData.js';

const now = Date.UTC(2026, 9, 12, 18);

const defaults: GiveawayDefaults = {
 winnerCount: 2,
 durationSeconds: 3600,
 collectSeconds: null,
 accentColor: null,
 logChannel: null,
 dmWinners: true,
 trackActivity: false,
 botToken: null,
};

const template = (overrides: Record<string, unknown> = {}) =>
 ({
  id: '1',
  guild: '2',
  name: 'Weekly',
  description: 'A Steam key',
  prize: null,
  channel: null,
  host: null,
  duration: null,
  winnerCount: null,
  collectSeconds: null,
  failReroll: false,
  requiredRoles: ['r'],
  excludedRoles: [],
  minAccountSeconds: null,
  minTenureSeconds: null,
  minMessages: null,
  minMessagesSince: null,
  minVoiceSeconds: null,
  enforcement: GiveawayEnforcement.onEnd,
  bonusRoles: [],
  bonusExtra: 1,
  personalPrizes: false,
  currency: null,
  winnerRoles: [],
  embed: null,
  components: null,
  banner: null,
  thumbnail: null,
  accentColor: null,
  repeatSeconds: null,
  nextRunAt: null,
  ...overrides,
 }) as unknown as GiveawayTemplate;

describe('templatePlan', () => {
 it('falls back to the server defaults for duration and winners', () => {
  const { data } = templatePlan(template(), defaults, now);

  assert.equal((data.endTime as Date).getTime(), now + 3600000);
  assert.equal(data.winnerCount, 2);
  assert.equal(data.template, '1');
  assert.deepEqual(data.requiredRoles, ['r']);
 });

 it('prefers the template values and clamps the winner count', () => {
  const { data } = templatePlan(template({ duration: 60, winnerCount: 500 }), defaults, now);

  assert.equal((data.endTime as Date).getTime(), now + 60000);
  assert.equal(data.winnerCount, 100);
 });

 it('refuses a template without a prize description', () => {
  assert.throws(() => templatePlan(template({ description: '  ' }), defaults, now), {
   message: GiveawayErrors.missingDescription,
  });
 });

 it('keeps a positive currency and drops zero', () => {
  assert.equal(templatePlan(template({ currency: 250 }), defaults, now).data.currency, 250);
  assert.equal(templatePlan(template({ currency: 0 }), defaults, now).data.currency, null);
 });
});

describe('withDefaults', () => {
 it('throws when neither the giveaway nor the server has a duration', () => {
  assert.throws(() => withDefaults({}, { ...defaults, durationSeconds: null }, now), {
   message: GiveawayErrors.missingDefaults,
   cause: [GiveawayOption.Time],
  });
 });

 it('never overwrites a value the giveaway already has', () => {
  const filled = withDefaults({ winnerCount: 5, collectSeconds: 7200 }, defaults, now);

  assert.equal(filled.winnerCount, 5);
  assert.equal(filled.collectSeconds, 7200);
 });
});

describe('templateOverrides', () => {
 it('maps the command options onto the template columns', () => {
  const overrides = templateOverrides({
   description: 'Game key',
   prize: 'KEY-123',
   winners: 3,
   time: '2h',
  });

  assert.equal(overrides.description, 'Game key');
  assert.equal(overrides.prize, 'KEY-123');
  assert.equal(Number(overrides.winnerCount), 3);
  assert.equal(Number(overrides.duration), 7200);
 });

 it('returns nothing when no option was given', () => {
  assert.deepEqual(templateOverrides({}), {});
 });

 it('refuses a duration it cannot read', () => {
  assert.throws(() => templateOverrides({ time: 'soon' }), {
   message: GiveawayErrors.invalidTime,
  });
 });

 it('lets a template without a description start once one is given', () => {
  const { data } = templatePlan(
   {
    ...template({ description: '' }),
    ...templateOverrides({ description: 'Game key', time: '1h' }),
   },
   defaults,
   now,
  );

  assert.equal(data.description, 'Game key');
  assert.equal((data.endTime as Date).getTime(), now + 3600000);
 });
});
