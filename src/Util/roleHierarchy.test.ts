import assert from 'node:assert';
import { test } from 'node:test';

import {
 NO_ROLE_POSITION,
 RoleWriteVerdict,
 highestPositionIn,
 partitionRoles,
 resolveRoleVerdict,
 roleIndexFrom,
 type BotRoleContext,
 type RoleIndex,
} from './roleHierarchy.js';

const guildId = 'G';

const index: RoleIndex = roleIndexFrom([
 { id: 'G', position: 0, managed: false, permissions: '0' },
 { id: 'LOW', position: 1, managed: false, permissions: '0' },
 { id: 'MANAGED', position: 2, managed: true, permissions: '0' },
 { id: 'MID', position: 3, managed: false, permissions: '0' },
 { id: 'PEER', position: 5, managed: false, permissions: '0' },
 { id: 'HIGH', position: 9, managed: false, permissions: '0' },
]);

const bot: BotRoleContext = { position: 5, canManageRoles: true };

const verdict = (roleId: string, overrides: Partial<BotRoleContext> = {}) =>
 resolveRoleVerdict({ guildId, roleId, index, bot: { ...bot, ...overrides } });

test('roleIndexFrom keeps only position and managed per role id', () => {
 assert.deepStrictEqual(index.get('MANAGED'), { position: 2, managed: true });
 assert.deepStrictEqual(index.get('LOW'), { position: 1, managed: false });
 assert.strictEqual(index.get('NOPE'), undefined);
});

test('highestPositionIn resolves the bot highest from a role set', () => {
 assert.strictEqual(highestPositionIn(index, ['LOW', 'MID']), 3);
 assert.strictEqual(highestPositionIn(index, ['HIGH', 'LOW']), 9);
 assert.strictEqual(highestPositionIn(index, ['NOPE']), NO_ROLE_POSITION);
 assert.strictEqual(highestPositionIn(index, []), NO_ROLE_POSITION);
});

test('resolveRoleVerdict returns Ok for a plain role below the bot', () => {
 assert.strictEqual(verdict('LOW'), RoleWriteVerdict.Ok);
});

test('resolveRoleVerdict returns Everyone for the guild id role', () => {
 assert.strictEqual(verdict('G'), RoleWriteVerdict.Everyone);
});

test('resolveRoleVerdict returns Missing for a role absent from the index', () => {
 assert.strictEqual(verdict('NOPE'), RoleWriteVerdict.Missing);
});

test('resolveRoleVerdict returns BotMissingPermission before any hierarchy verdict', () => {
 assert.strictEqual(verdict('LOW', { canManageRoles: false }), RoleWriteVerdict.BotMissingPermission);
 assert.strictEqual(
  verdict('MANAGED', { canManageRoles: false }),
  RoleWriteVerdict.BotMissingPermission,
 );
});

test('resolveRoleVerdict returns Managed unless managed roles are explicitly allowed', () => {
 assert.strictEqual(verdict('MANAGED'), RoleWriteVerdict.Managed);
 assert.strictEqual(
  resolveRoleVerdict({ guildId, roleId: 'MANAGED', index, bot, allowManaged: true }),
  RoleWriteVerdict.Ok,
 );
});

test('resolveRoleVerdict returns AboveBot at or above the bot highest, and on an unknown bot position', () => {
 assert.strictEqual(verdict('HIGH'), RoleWriteVerdict.AboveBot);
 assert.strictEqual(verdict('PEER'), RoleWriteVerdict.AboveBot);
 assert.strictEqual(verdict('LOW', { position: null }), RoleWriteVerdict.AboveBot);
});

test('resolveRoleVerdict returns AboveExecutor at or above the executor highest', () => {
 assert.strictEqual(
  resolveRoleVerdict({ guildId, roleId: 'MID', index, bot, executorPosition: 3 }),
  RoleWriteVerdict.AboveExecutor,
 );
 assert.strictEqual(
  resolveRoleVerdict({ guildId, roleId: 'LOW', index, bot, executorPosition: 3 }),
  RoleWriteVerdict.Ok,
 );
});

test('resolveRoleVerdict bypasses the executor check for the guild owner only', () => {
 assert.strictEqual(
  resolveRoleVerdict({
   guildId,
   roleId: 'MID',
   index,
   bot,
   executorPosition: NO_ROLE_POSITION,
   executorIsOwner: true,
  }),
  RoleWriteVerdict.Ok,
 );
 assert.strictEqual(
  resolveRoleVerdict({
   guildId,
   roleId: 'HIGH',
   index,
   bot,
   executorPosition: NO_ROLE_POSITION,
   executorIsOwner: true,
  }),
  RoleWriteVerdict.AboveBot,
 );
});

test('partitionRoles splits ok from rejected with the reason per role', () => {
 const result = partitionRoles({
  guildId,
  index,
  bot,
  roleIds: ['LOW', 'MID', 'G', 'NOPE', 'MANAGED', 'HIGH'],
 });

 assert.deepStrictEqual(result.ok, ['LOW', 'MID']);
 assert.deepStrictEqual(
  [...result.rejected],
  [
   ['G', RoleWriteVerdict.Everyone],
   ['NOPE', RoleWriteVerdict.Missing],
   ['MANAGED', RoleWriteVerdict.Managed],
   ['HIGH', RoleWriteVerdict.AboveBot],
  ],
 );
});

test('partitionRoles preserves an above-bot role the target already holds', () => {
 const result = partitionRoles({
  guildId,
  index,
  bot,
  roleIds: ['HIGH', 'LOW', 'MANAGED'],
  heldByTarget: ['HIGH'],
 });

 assert.deepStrictEqual(result.ok, ['HIGH', 'LOW']);
 assert.deepStrictEqual([...result.rejected], [['MANAGED', RoleWriteVerdict.Managed]]);
});

test('partitionRoles never preserves an above-bot role the target does not hold', () => {
 const result = partitionRoles({
  guildId,
  index,
  bot,
  roleIds: ['HIGH'],
  heldByTarget: ['LOW'],
 });

 assert.deepStrictEqual(result.ok, []);
 assert.deepStrictEqual([...result.rejected], [['HIGH', RoleWriteVerdict.AboveBot]]);
});
