import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ActivitySource } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import { FieldArity, assertSchemaValid } from '../../settings/SettingsSchema.js';
import { minInactivitySeconds } from '../constants.js';
import type CustomRolesPlugin from '../Plugin.js';

import ActivityTracker from './ActivityTracker.js';
import schema, { CustomRolesGroup } from './settingsSchema.js';

const inactivity = schema.groups.find((group) => group.id === CustomRolesGroup.Inactivity);
const field = (column: string) => inactivity?.fields.find((entry) => entry.column === column);

describe('custom role inactivity section', () => {
 it('is the third section of the custom roles page and passes schema validation', () => {
  assert.deepEqual(
   schema.groups.map((group) => group.id),
   [CustomRolesGroup.Reward, CustomRolesGroup.CustomRole, CustomRolesGroup.Inactivity],
  );
  assert.doesNotThrow(() => assertSchemaValid(schema));
 });

 it('keeps the reward active switch as the only header toggle and the wipe switch in its section', () => {
  const toggles = schema.groups.flatMap((group) => group.fields).filter((entry) => entry.headerToggle);

  assert.deepEqual(
   toggles.map((entry) => entry.column),
   ['active'],
  );
  assert.ok(field('inactivityWipe'));
 });

 it('offers every activity source as a multi-select', () => {
  const sources = field('activitySources');
  const values = Array.isArray(sources?.options) ? sources.options.map((o) => o.value) : [];

  assert.equal(sources?.arity, FieldArity.Multi);
  assert.deepEqual([...values].sort(), Object.values(ActivitySource).sort());
 });

 it('refuses an inactivity period under a day', () => {
  const validate = field('inactiveAfter')?.validate;

  assert.equal(validate?.(minInactivitySeconds - 1, {})?.ok, false);
  assert.equal(validate?.(minInactivitySeconds, {})?.ok, true);
 });
});

interface Calls {
 claims: string[];
 updates: number;
 inserts: number;
}

const tracker = (sources: ActivitySource[][], claimed: boolean, existing: number) => {
 const calls: Calls = { claims: [], updates: 0, inserts: 0 };
 const client = {
  cache: {
   cacheDb: {
    set: async (key: string) => {
     calls.claims.push(key);
     return claimed ? 'OK' : null;
    },
   },
  },
  db: {
   client: {
    roleReward: {
     findMany: async () => sources.map((activitySources) => ({ activitySources })),
    },
    lastActive: {
     updateMany: async () => {
      calls.updates += 1;
      return { count: existing };
     },
     createMany: async () => {
      calls.inserts += 1;
      return { count: 1 };
     },
    },
   },
  },
 } as unknown as Client;

 return { activity: new ActivityTracker({ client } as unknown as CustomRolesPlugin), calls };
};

describe('custom role activity tracking', () => {
 it('records a counted activity per type once per throttle window', async () => {
  const { activity, calls } = tracker([[ActivitySource.Messages]], true, 0);
  await activity.record('g', 'u', ActivitySource.Messages);

  assert.deepEqual(calls.claims, ['customroles:activity:g:u:Messages', 'customroles:observed:g:Messages']);
  assert.equal(calls.inserts, 1);
 });

 it('counts a type selected by any reward in the guild', async () => {
  const { activity, calls } = tracker([[ActivitySource.Messages], [ActivitySource.Voice]], true, 1);
  await activity.record('g', 'u', ActivitySource.Voice);

  assert.equal(calls.updates, 1);
  assert.equal(calls.inserts, 0);
 });

 it('skips types no wiping reward counts, and throttled members', async () => {
  const other = tracker([[ActivitySource.Messages]], true, 0);
  await other.activity.record('g', 'u', ActivitySource.Voice);
  const none = tracker([], true, 0);
  await none.activity.record('g', 'u', ActivitySource.Messages);
  const throttled = tracker([[ActivitySource.Messages]], false, 0);
  await throttled.activity.record('g', 'u', ActivitySource.Messages);

  assert.equal(other.calls.claims.length + none.calls.claims.length, 0);
  assert.equal(throttled.calls.updates, 0);
 });
});
