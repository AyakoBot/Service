import assert from 'node:assert';
import { test } from 'node:test';

import type Client from '../Classes/Client.js';

import { roleIndexFrom, type BotRoleContext } from './roleHierarchy.js';
import RoleWriteQueue, {
 maxQueueDepthPerGuild,
 RoleWritePriority,
 RoleWriteRefusal,
 compareJobs,
 computeTargetRoles,
 memoKey,
 targetRolesMemoised,
 type RoleWriteJob,
} from './roleWriteQueue.js';

const guildId = 'G';

const roles = [
 { id: 'G', position: 0, managed: false, permissions: '0' },
 { id: 'LOW', position: 1, managed: false, permissions: '0' },
 { id: 'MANAGED', position: 2, managed: true, permissions: '0' },
 { id: 'MID', position: 3, managed: false, permissions: '0' },
 { id: 'BOTROLE', position: 5, managed: false, permissions: '268435456' },
 { id: 'HIGH', position: 9, managed: false, permissions: '0' },
];

const index = roleIndexFrom(roles);
const bot: BotRoleContext = { position: 5, canManageRoles: true };

const job = (userId: string, priority: RoleWritePriority, enqueuedAt: number): RoleWriteJob => ({
 guildId,
 userId,
 add: new Set<string>(),
 remove: new Set<string>(),
 reason: 'reason',
 priority,
 enqueuedAt,
});

interface StubState {
 memberRoles: string[];
 canManageRoles: boolean;
 edits: { userId: string; roles: string[]; reason: string }[];
 reports: string[];
}

const stubClient = (state: StubState) =>
 ({
  logger: { error: (line: string) => state.reports.push(line) },
  cache: {
   roles: { getAll: async () => roles },
   guilds: { get: async () => ({ owner_id: 'OWNER' }) },
   members: {
    get: async (_guildId: string, userId: string) =>
     (userId === 'BOT'
      ? { user_id: 'BOT', guild_id: guildId, roles: ['BOTROLE'] }
      : { user_id: userId, guild_id: guildId, roles: state.memberRoles }),
   },
  },
  getAPI: async () => ({
   botId: 'BOT',
   guilds: {
    util: {
     canManageRoles: async () =>
      (state.canManageRoles
       ? { response: true, debug: 0 }
       : { response: false, debug: 1, message: 'Missing ManageRoles permission' }),
    },
    editMember: async (
     _guildId: string,
     userId: string,
     body: { roles: string[] },
     opts: { reason: string },
    ) => {
     state.edits.push({ userId, roles: body.roles, reason: opts.reason });
     return {};
    },
   },
  }),
 }) as never as Client;

test('compareJobs orders oldest-first inside one priority band', () => {
 const jobs = [
  job('C', RoleWritePriority.Automation, 300),
  job('A', RoleWritePriority.Automation, 100),
  job('B', RoleWritePriority.Automation, 200),
 ];

 assert.deepStrictEqual(
  jobs.sort(compareJobs).map((j) => j.userId),
  ['A', 'B', 'C'],
 );
});

test('compareJobs lets a lower priority band overtake an older job in a higher band', () => {
 const jobs = [
  job('BULK', RoleWritePriority.Bulk, 1),
  job('AUTOMATION', RoleWritePriority.Automation, 2),
  job('INTERACTIVE', RoleWritePriority.Interactive, 3),
 ];

 assert.deepStrictEqual(
  jobs.sort(compareJobs).map((j) => j.userId),
  ['INTERACTIVE', 'AUTOMATION', 'BULK'],
 );
});

test('computeTargetRoles coalesces adds and removes into one target array', () => {
 const target = computeTargetRoles({
  guildId,
  current: ['LOW'],
  add: ['MID'],
  remove: ['LOW'],
  index,
  bot,
 });

 assert.deepStrictEqual([...target].sort(), ['MID']);
});

test('computeTargetRoles drops @everyone, managed, missing and above-bot roles from adds', () => {
 const target = computeTargetRoles({
  guildId,
  current: [],
  add: ['LOW', 'G', 'MANAGED', 'NOPE', 'HIGH'],
  remove: [],
  index,
  bot,
 });

 assert.deepStrictEqual([...target].sort(), ['LOW']);
});

test('computeTargetRoles never strips an above-bot or managed role the member already holds', () => {
 const target = computeTargetRoles({
  guildId,
  current: ['HIGH', 'MANAGED', 'LOW'],
  add: [],
  remove: ['HIGH', 'MANAGED', 'LOW'],
  index,
  bot,
 });

 assert.deepStrictEqual([...target].sort(), ['HIGH', 'MANAGED']);
});

test('computeTargetRoles never emits @everyone even when the member cache carries it', () => {
 const target = computeTargetRoles({
  guildId,
  current: ['G', 'LOW'],
  add: [],
  remove: [],
  index,
  bot,
 });

 assert.deepStrictEqual([...target].sort(), ['LOW']);
});

test('memoKey is stable across role ordering and duplicates', () => {
 const a = memoKey({ current: ['LOW', 'HIGH'], add: ['MID'], remove: [] });
 const b = memoKey({ current: ['HIGH', 'LOW', 'LOW'], add: ['MID'], remove: [] });
 const c = memoKey({ current: ['HIGH', 'LOW'], add: [], remove: ['MID'] });

 assert.strictEqual(a, b);
 assert.notStrictEqual(a, c);
});

test('targetRolesMemoised reuses the computed array for an identical role set', () => {
 const memo = new Map<string, string[]>();
 const input = { guildId, current: ['LOW'], add: ['MID'], remove: [], index, bot };

 const first = targetRolesMemoised(memo, input);
 const second = targetRolesMemoised(memo, { ...input });
 const other = targetRolesMemoised(memo, { ...input, current: ['MID'] });

 assert.strictEqual(first, second);
 assert.strictEqual(memo.size, 2);
 assert.notStrictEqual(first, other);
});

test('enqueue refuses past the guild depth bound instead of dropping silently', () => {
 const state: StubState = { memberRoles: ['LOW'], canManageRoles: true, edits: [], reports: [] };
 const queue = new RoleWriteQueue(stubClient(state));

 for (let i = 0; i < maxQueueDepthPerGuild; i += 1) {
  assert.strictEqual(queue.enqueue({ guildId, userId: `U${i}`, add: ['LOW'], reason: 'r' }), null);
 }

 assert.strictEqual(queue.depth(guildId), maxQueueDepthPerGuild);
 assert.strictEqual(
  queue.enqueue({ guildId, userId: 'OVERFLOW', add: ['LOW'], reason: 'r' }),
  RoleWriteRefusal.QueueFull,
 );
 assert.strictEqual(queue.enqueue({ guildId, userId: 'U0', add: ['MID'], reason: 'r' }), null);
 assert.strictEqual(queue.depth(guildId), maxQueueDepthPerGuild);
});

test('enqueue merges into the one pending job per member, keeping its original age', () => {
 const state: StubState = { memberRoles: ['LOW'], canManageRoles: true, edits: [], reports: [] };
 const queue = new RoleWriteQueue(stubClient(state));

 queue.enqueue({
  guildId,
  userId: 'U1',
  add: ['MID', 'LOW'],
  reason: 'first',
  priority: RoleWritePriority.Bulk,
 });
 const enqueuedAt = queue.pending(guildId, 'U1')?.enqueuedAt;

 queue.enqueue({
  guildId,
  userId: 'U1',
  remove: ['LOW'],
  reason: 'second',
  priority: RoleWritePriority.Interactive,
 });

 const pending = queue.pending(guildId, 'U1');
 assert.deepStrictEqual([...(pending?.add ?? [])], ['MID']);
 assert.deepStrictEqual([...(pending?.remove ?? [])], ['LOW']);
 assert.strictEqual(pending?.priority, RoleWritePriority.Interactive);
 assert.strictEqual(pending?.enqueuedAt, enqueuedAt);
 assert.strictEqual(queue.depth(guildId), 1);
});

test('drain computes the target from the member state read at flush time', async () => {
 const state: StubState = { memberRoles: ['LOW'], canManageRoles: true, edits: [], reports: [] };
 const queue = new RoleWriteQueue(stubClient(state));

 queue.enqueue({ guildId, userId: 'U1', add: ['MID'], reason: 'grant' });
 state.memberRoles = ['LOW', 'HIGH'];

 await queue.drain(guildId);

 assert.strictEqual(state.edits.length, 1);
 assert.deepStrictEqual(state.edits[0].roles.slice().sort(), ['HIGH', 'LOW', 'MID']);
 assert.strictEqual(state.edits[0].reason, 'grant');
 assert.strictEqual(queue.depth(guildId), 0);
});

test('drain holds every job and writes nothing while the bot lacks ManageRoles', async () => {
 const state: StubState = { memberRoles: ['LOW'], canManageRoles: false, edits: [], reports: [] };
 const queue = new RoleWriteQueue(stubClient(state));

 queue.enqueue({ guildId, userId: 'U1', add: ['MID'], reason: 'grant' });
 await queue.drain(guildId);

 assert.strictEqual(state.edits.length, 0);
 assert.strictEqual(queue.depth(guildId), 1);
 assert.notStrictEqual(queue.pending(guildId, 'U1'), undefined);

 state.canManageRoles = true;
 await queue.drain(guildId);

 assert.strictEqual(state.edits.length, 1);
 assert.strictEqual(queue.depth(guildId), 0);
});

test('drain reports a held guild once per held stretch, not once per flush pass', async () => {
 const state: StubState = { memberRoles: ['LOW'], canManageRoles: false, edits: [], reports: [] };
 const queue = new RoleWriteQueue(stubClient(state));

 queue.enqueue({ guildId, userId: 'U1', add: ['MID'], reason: 'grant' });

 await queue.drain(guildId);
 await queue.drain(guildId);
 await queue.drain(guildId);

 assert.strictEqual(state.reports.length, 1);
 assert.strictEqual(queue.depth(guildId), 1);

 state.canManageRoles = true;
 await queue.drain(guildId);
 assert.strictEqual(state.reports.length, 1);

 state.canManageRoles = false;
 queue.enqueue({ guildId, userId: 'U2', add: ['MID'], reason: 'grant' });
 await queue.drain(guildId);
 await queue.drain(guildId);

 assert.strictEqual(state.reports.length, 2);
});

test('drain skips the write when the coalesced target equals the current role set', async () => {
 const state: StubState = { memberRoles: ['LOW', 'MID'], canManageRoles: true, edits: [], reports: [] };
 const queue = new RoleWriteQueue(stubClient(state));

 queue.enqueue({ guildId, userId: 'U1', add: ['MID'], remove: ['HIGH'], reason: 'noop' });
 await queue.drain(guildId);

 assert.strictEqual(state.edits.length, 0);
 assert.strictEqual(queue.depth(guildId), 0);
});
