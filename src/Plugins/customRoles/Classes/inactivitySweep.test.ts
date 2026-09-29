import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ActivitySource } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import { CustomRolesKey } from '../constants.js';
import type CustomRolesPlugin from '../Plugin.js';
import { dayMs } from '../Util/inactivity.js';

import InactivitySweep from './InactivitySweep.js';

interface Reward {
 id: string;
 inactivityWipe: boolean;
 activitySources: ActivitySource[];
 inactiveAfter: number;
 trackingSince: Date | null;
}

interface Scenario {
 rewards: Reward[];
 granting: Record<string, string[]>;
 activity: { user: string; source: ActivitySource; days: number }[];
 cached?: string[];
 observed?: ActivitySource[];
 presence?: boolean;
}

const ago = (days: number) => new Date(Date.now() - days * dayMs);

const reward = (id: string, over: Partial<Reward> = {}): Reward => ({
 id,
 inactivityWipe: true,
 activitySources: [ActivitySource.Messages],
 inactiveAfter: 30 * 86_400,
 trackingSince: ago(60),
 ...over,
});

const run = async (scenario: Scenario) => {
 const now = Date.now();
 const redis = new Map<string, string>([
  [CustomRolesKey.WatchBeat, String(now - 60_000)],
  [CustomRolesKey.WatchSince, String(now - 90 * dayMs)],
 ]);
 (scenario.observed ?? [ActivitySource.Messages, ActivitySource.Voice]).forEach((source) =>
  redis.set(`${CustomRolesKey.Observed}:g:${source}`, String(now - dayMs)),
 );
 if (scenario.presence) {
  redis.set(`${CustomRolesKey.PresenceBeat}:g`, String(now - 60_000));
  redis.set(`${CustomRolesKey.PresenceSince}:g`, String(now - 90 * dayMs));
 }

 const rows = scenario.rewards.map((row) => ({ ...row, guild: 'g', active: true, customRole: true }));
 const owners = Object.keys(scenario.granting);
 const cached = new Set(scenario.cached ?? owners);
 const revoked: string[] = [];
 const stamped: unknown[] = [];

 const client = {
  cache: {
   cacheDb: {
    get: async (key: string) => redis.get(key) ?? null,
    set: async (key: string, value: string) => {
     redis.set(key, value);
     return 'OK';
    },
   },
   members: { get: async (_guild: string, user: string) => (cached.has(user) ? { roles: [] } : null) },
  },
  db: {
   client: {
    roleReward: {
     findMany: async () => rows.filter((row) => row.inactivityWipe).map(() => ({ guild: 'g' })),
     updateMany: async (args: { where: unknown }) => {
      stamped.push(args.where);
      return { count: 1 };
     },
    },
    customRole: { findMany: async () => owners.map((user) => ({ user })) },
    lastActive: {
     findMany: async () =>
      scenario.activity.map((entry) => ({ ...entry, lastActive: ago(entry.days) })),
    },
   },
  },
 } as unknown as Client;

 const plugin = {
  client,
  isEnabled: () => true,
  nonFatalError: (error: Error) => {
   throw error;
  },
  rewards: {
   rowsFor: async () => rows,
   resolveApplying: async (_guild: string, _roles: string[], user: string) =>
    rows.filter((row) => scenario.granting[user]?.includes(row.id)),
  },
  roles: {
   revoke: async (_guild: string, user: string) => {
    revoked.push(user);
    return true;
   },
  },
 } as unknown as CustomRolesPlugin;

 await new InactivitySweep(plugin).sweep();

 return { revoked: revoked.sort(), stamped };
};

describe('custom role inactivity sweep per reward', () => {
 it('wipes idle owners by their own reward settings and keeps the rest', async () => {
  const result = await run({
   rewards: [reward('A'), reward('B', { inactivityWipe: false })],
   granting: { idle: ['A'], recent: ['A'], both: ['A', 'B'], ghost: ['A'], voice: ['A'] },
   cached: ['idle', 'recent', 'both', 'voice'],
   activity: [
    { user: 'idle', source: ActivitySource.Messages, days: 40 },
    { user: 'recent', source: ActivitySource.Messages, days: 2 },
    { user: 'both', source: ActivitySource.Messages, days: 40 },
    { user: 'ghost', source: ActivitySource.Messages, days: 40 },
    { user: 'voice', source: ActivitySource.Voice, days: 1 },
   ],
  });

  assert.deepEqual(result.revoked, ['idle', 'voice']);
 });

 it('keeps a member while another granting reward still counts them active', async () => {
  const result = await run({
   rewards: [reward('A'), reward('C', { inactiveAfter: 60 * 86_400, trackingSince: ago(90) })],
   granting: { idle: ['A', 'C'] },
   activity: [{ user: 'idle', source: ActivitySource.Messages, days: 40 }],
  });

  assert.deepEqual(result.revoked, []);
 });

 it('stamps a reward without a tracking start and wipes nobody under it yet', async () => {
  const result = await run({
   rewards: [reward('A', { trackingSince: null })],
   granting: { idle: ['A'] },
   activity: [{ user: 'idle', source: ActivitySource.Messages, days: 200 }],
  });

  assert.deepEqual(result.revoked, []);
  assert.equal(result.stamped.length, 1);
 });

 it('wipes nobody when none of the reward types was ever observed in the guild', async () => {
  const result = await run({
   rewards: [reward('A')],
   granting: { idle: ['A'] },
   activity: [{ user: 'idle', source: ActivitySource.Messages, days: 40 }],
   observed: [ActivitySource.Voice],
  });

  assert.deepEqual(result.revoked, []);
 });

 // TODO: request presence intent for this
 // it('wipes nobody under an online-counting reward until presence updates arrive', async () => {
  // const online = reward('A', { activitySources: [ActivitySource.Messages, ActivitySource.Online] });
  // const base = {
   // rewards: [online],
   // granting: { idle: ['A'] },
   // activity: [{ user: 'idle', source: ActivitySource.Messages, days: 40 }],
  // };
 //
  // assert.deepEqual((await run(base)).revoked, []);
  // assert.deepEqual((await run({ ...base, presence: true })).revoked, ['idle']);
 // });
});
