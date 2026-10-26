import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GiveawayEnforcement, type Giveaway } from '@ayako/database';

import {
 GiveawayRequirement,
 failedRequirements,
 needsActivity,
 requirementNote,
 requirementOrder,
 type RequirementSubject,
} from './requirements.js';

const discordEpoch = 1420070400000n;
const days = (amount: number) => amount * 86400000;
const hours = (amount: number) => amount * 3600000;

const snowflake = (ageMs: number) => String((BigInt(Date.now() - ageMs) - discordEpoch) << 22n);

const giveaway = (overrides: Record<string, unknown> = {}) =>
 ({
  guild: '1',
  message: '2',
  channel: '3',
  description: 'A prize',
  prize: null,
  host: '4',
  winnerCount: 1,
  endTime: new Date(Date.now() + hours(1)),
  requiredRoles: [],
  participants: [],
  winners: [],
  unclaimedWinners: [],
  ended: false,
  cancelled: false,
  collectSeconds: null,
  failReroll: false,
  claimUntil: null,
  claimingDone: false,
  announceMessage: null,
  excludedRoles: [],
  minAccountSeconds: null,
  minTenureSeconds: null,
  minMessages: null,
  minMessagesSince: null,
  minVoiceSeconds: null,
  enforcement: GiveawayEnforcement.onEnd,
  design: null,
  banner: null,
  thumbnail: null,
  accentColor: null,
  ...overrides,
 }) as unknown as Giveaway;

const subject = (overrides: Partial<RequirementSubject> = {}): RequirementSubject => ({
 userId: snowflake(days(365)),
 roles: [],
 joinedAt: new Date(Date.now() - days(365)).toISOString(),
 messages: 0,
 messagesSince: 0,
 voiceSeconds: 0,
 ...overrides,
});

const translator = {
 unmet: {
  role: (vars: { role: string }) => `role:${vars.role}`,
  excluded: (vars: { role: string }) => `excluded:${vars.role}`,
  accountAge: (vars: { time: string }) => `accountAge:${vars.time}`,
  tenure: (vars: { time: string }) => `tenure:${vars.time}`,
  messages: (vars: { count: string }) => `messages:${vars.count}`,
  messagesSince: (vars: { count: string }) => `messagesSince:${vars.count}`,
  voiceTime: (vars: { time: string }) => `voiceTime:${vars.time}`,
 },
} as unknown as Parameters<typeof requirementNote>[0];

const everyGate = {
 excludedRoles: ['excluded-role'],
 requiredRoles: ['required-role'],
 minAccountSeconds: days(30) / 1000,
 minTenureSeconds: days(30) / 1000,
 minMessages: 10,
 minMessagesSince: 5,
 minVoiceSeconds: 3600,
};

const hostile = (extraRoles: string[] = []) =>
 subject({
  userId: snowflake(hours(1)),
  roles: ['excluded-role', ...extraRoles],
  joinedAt: null,
 });

describe('failedRequirements', () => {
 it('disqualifies nobody when no requirement column is set', () => {
  assert.deepEqual(failedRequirements(giveaway(), subject()), []);
  assert.deepEqual(failedRequirements(giveaway(), hostile()), []);
 });

 it('checks requiredRoles on their own', () => {
  const g = giveaway({ requiredRoles: ['r'] });

  assert.deepEqual(failedRequirements(g, subject({ roles: [] })), [GiveawayRequirement.Role]);
  assert.deepEqual(failedRequirements(g, subject({ roles: ['r'] })), []);
 });

 it('accepts any one of several required roles', () => {
  const g = giveaway({ requiredRoles: ['a', 'b'] });

  assert.deepEqual(failedRequirements(g, subject({ roles: ['b'] })), []);
  assert.deepEqual(failedRequirements(g, subject({ roles: ['c'] })), [GiveawayRequirement.Role]);
 });

 it('blocks a member holding any one of several excluded roles', () => {
  const g = giveaway({ excludedRoles: ['x', 'y'] });

  assert.deepEqual(failedRequirements(g, subject({ roles: ['y'] })), [
   GiveawayRequirement.Excluded,
  ]);
  assert.deepEqual(failedRequirements(g, subject({ roles: ['other'] })), []);
 });

 it('reports every failure in requirementOrder, excluded before role', () => {
  const failed = failedRequirements(giveaway(everyGate), hostile());

  assert.deepEqual(failed, requirementOrder);
  assert.equal(failed[0], GiveawayRequirement.Excluded);
  assert.equal(failed[1], GiveawayRequirement.Role);
 });
});

describe('account age', () => {
 it('passes an account older than the threshold and fails a younger one', () => {
  const g = giveaway({ minAccountSeconds: days(7) / 1000 });

  assert.deepEqual(failedRequirements(g, subject({ userId: snowflake(days(30)) })), []);
  assert.deepEqual(failedRequirements(g, subject({ userId: snowflake(hours(1)) })), [
   GiveawayRequirement.AccountAge,
  ]);
 });

 it('ignores the account entirely when unset', () => {
  assert.deepEqual(failedRequirements(giveaway(), subject({ userId: snowflake(0) })), []);
 });

 it('fails closed on an unreadable user id', () => {
  const g = giveaway({ minAccountSeconds: days(7) / 1000 });

  assert.deepEqual(failedRequirements(g, subject({ userId: 'not-a-snowflake' })), [
   GiveawayRequirement.AccountAge,
  ]);
 });
});

describe('tenure', () => {
 const g = giveaway({ minTenureSeconds: days(7) / 1000 });

 it('passes a member who joined before the threshold', () => {
  const joinedAt = new Date(Date.now() - days(30)).toISOString();
  assert.deepEqual(failedRequirements(g, subject({ joinedAt })), []);
 });

 it('fails a member who joined after the threshold', () => {
  const joinedAt = new Date(Date.now() - hours(1)).toISOString();
  assert.deepEqual(failedRequirements(g, subject({ joinedAt })), [GiveawayRequirement.Tenure]);
 });

 it('fails closed on a null or unparseable joinedAt', () => {
  assert.deepEqual(failedRequirements(g, subject({ joinedAt: null })), [
   GiveawayRequirement.Tenure,
  ]);
  assert.deepEqual(failedRequirements(g, subject({ joinedAt: 'yesterday' })), [
   GiveawayRequirement.Tenure,
  ]);
 });

 it('ignores a null joinedAt when no tenure is required', () => {
  assert.deepEqual(failedRequirements(giveaway(), subject({ joinedAt: null })), []);
 });
});

describe('activity thresholds', () => {
 it('checks minMessages on its own', () => {
  const g = giveaway({ minMessages: 10 });

  assert.deepEqual(failedRequirements(g, subject({ messages: 10 })), []);
  assert.deepEqual(failedRequirements(g, subject({ messages: 9 })), [GiveawayRequirement.Messages]);
 });

 it('checks minMessagesSince on its own', () => {
  const g = giveaway({ minMessagesSince: 3 });

  assert.deepEqual(failedRequirements(g, subject({ messagesSince: 4 })), []);
  assert.deepEqual(failedRequirements(g, subject({ messagesSince: 2 })), [
   GiveawayRequirement.MessagesSince,
  ]);
 });

 it('checks minVoiceSeconds on its own', () => {
  const g = giveaway({ minVoiceSeconds: 3600 });

  assert.deepEqual(failedRequirements(g, subject({ voiceSeconds: 3600 })), []);
  assert.deepEqual(failedRequirements(g, subject({ voiceSeconds: 3599 })), [
   GiveawayRequirement.VoiceTime,
  ]);
 });

 it('ignores the subject values entirely when the thresholds are null', () => {
  const zeroed = subject({ messages: 0, messagesSince: 0, voiceSeconds: 0 });
  assert.deepEqual(failedRequirements(giveaway(), zeroed), []);
 });
});

describe('requirementNote', () => {
 it('reports the first failure only', () => {
  const g = giveaway(everyGate);
  const failed = failedRequirements(g, hostile());

  assert.equal(requirementNote(translator, g, failed), 'excluded:<@&excluded-role>');
 });

 it('reports the required roles when that is the first failure', () => {
  const g = giveaway({ requiredRoles: ['r', 's'] });
  const failed = failedRequirements(g, subject());

  assert.equal(requirementNote(translator, g, failed), 'role:<@&r> or <@&s>');
 });

 it('renders the account age note with a formatted duration', () => {
  const g = giveaway({ minAccountSeconds: days(7) / 1000 });
  const failed = failedRequirements(g, subject({ userId: snowflake(hours(1)) }));

  assert.equal(requirementNote(translator, g, failed), 'accountAge:1w');
 });

 it('is null when nothing failed', () => {
  assert.equal(requirementNote(translator, giveaway(), []), null);
 });
});

describe('needsActivity', () => {
 it('is true only when an activity column is set', () => {
  assert.equal(needsActivity(giveaway()), false);
  assert.equal(needsActivity(giveaway({ minMessages: 1 })), true);
  assert.equal(needsActivity(giveaway({ minMessagesSince: 1 })), true);
  assert.equal(needsActivity(giveaway({ minVoiceSeconds: 1 })), true);
 });

 it('ignores non-activity requirements', () => {
  assert.equal(needsActivity(giveaway({ requiredRoles: ['r'], minTenureSeconds: 60 })), false);
 });
});
