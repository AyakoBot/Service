import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EditorType } from '../EditorType.js';
import type { RowGuardContext, SettingsField } from '../SettingsSchema.js';

import { resolveVirtualFields } from './resolveVirtualFields.js';

const ctx = {} as RowGuardContext;

const field = (
 column: string,
 read: (row: Record<string, unknown>, ctx: RowGuardContext) => Promise<unknown>,
): SettingsField =>
 ({
  column,
  editor: EditorType.String,
  label: column,
  virtual: { read, write: async () => ({ ok: true }) },
 }) as unknown as SettingsField;

const plain: SettingsField = {
 column: 'name',
 editor: EditorType.String,
 label: 'Name',
} as unknown as SettingsField;

test('returns an empty object when no field is virtual', async () => {
 assert.deepEqual(await resolveVirtualFields([plain], { name: 'a' }, ctx), {});
});

test('resolves virtual reads keyed by column', async () => {
 const resolved = await resolveVirtualFields(
  [plain, field('profileNick', async () => 'Support Team')],
  { name: 'a' },
  ctx,
 );
 assert.deepEqual(resolved, { profileNick: 'Support Team' });
});

test('yields null for a read that throws', async () => {
 const resolved = await resolveVirtualFields(
  [
   field('profileNick', async () => {
    throw new Error('cache down');
   }),
  ],
  {},
  ctx,
 );
 assert.deepEqual(resolved, { profileNick: null });
});

test('forwards the row and context to read', async () => {
 const seen: { row?: Record<string, unknown>; ctx?: RowGuardContext } = {};
 const echo = field('profileNick', async (row, readCtx) => {
  seen.row = row;
  seen.ctx = readCtx;
  return row.name;
 });

 const resolved = await resolveVirtualFields([echo], { name: 'a' }, ctx);

 assert.deepEqual(resolved, { profileNick: 'a' });
 assert.deepEqual(seen.row, { name: 'a' });
 assert.equal(seen.ctx, ctx);
});

test('yields null for a read that exceeds the timeout', async () => {
 const slow = field('profileNick', () => new Promise((resolve) => setTimeout(resolve, 5000)));
 const started = process.hrtime.bigint();
 const resolved = await resolveVirtualFields([slow], {}, ctx);
 const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;

 assert.deepEqual(resolved, { profileNick: null });
 assert.ok(elapsedMs < 4000, `expected the timeout to cut in, took ${elapsedMs}ms`);
});
