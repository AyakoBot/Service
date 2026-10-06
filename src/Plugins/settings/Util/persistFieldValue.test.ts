import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Prisma } from '@ayako/database';

import type SettingsPlugin from '../Plugin.js';
import type { SettingsField } from '../SettingsSchema.js';

import persistFieldValue from './persistFieldValue.js';

const rejecting = (error: Error) =>
 ({
  tableClient: () => ({
   updateMany: async () => {
    throw error;
   },
  }),
  t: async () => ({ navigator: { valueRequired: () => 'needs a value' } }),
 }) as unknown as SettingsPlugin;

const argsFor = (value: unknown) =>
 ({
  field: { column: 'anonymity' } as SettingsField,
  value,
  row: {},
  table: 'confessionSetting',
  rowId: '1',
  guildId: '1',
  owner: {},
 }) as unknown as Parameters<typeof persistFieldValue>[0];

const invalid = (message: string) =>
 new Prisma.PrismaClientValidationError(message, { clientVersion: 'test' });

test('a null the column rejects comes back as a missing value', async () => {
 const plugin = rejecting(invalid('Argument `anonymity` must not be null.'));

 assert.deepEqual(await persistFieldValue.call(plugin, argsFor(null)), {
  ok: false,
  reason: 'needs a value',
 });
});

test('every other write failure still throws', async () => {
 await assert.rejects(persistFieldValue.call(rejecting(invalid('wrong type')), argsFor('x')));
 await assert.rejects(persistFieldValue.call(rejecting(new Error('db down')), argsFor(null)));
});
