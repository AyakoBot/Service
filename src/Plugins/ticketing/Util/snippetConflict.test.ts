import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SnippetErrors } from '../Classes/Enums.js';
import type TicketPlugin from '../Plugin.js';

import { snippetConflict } from './snippetConflict.js';

type Row = { id: string; name: string; trigger: string | null };

const plugin = (rows: Row[], prefixes: string[][] = []) =>
 ({
  client: {
   db: {
    client: {
     snippets: {
      findUnique: ({ where }: { where: Record<string, { name?: string; trigger?: string }> }) => {
       const byName = where.guild_name;
       if (byName) return Promise.resolve(rows.find((r) => r.name === byName.name) ?? null);

       const byTrigger = where.guild_trigger;
       return Promise.resolve(rows.find((r) => r.trigger === byTrigger?.trigger) ?? null);
      },
     },
     ticketSetting: {
      findMany: () =>
       Promise.resolve(prefixes.map((sendMessagePrefixes) => ({ sendMessagePrefixes }))),
     },
    },
   },
  },
 }) as unknown as TicketPlugin;

const check = (
 rows: Row[],
 data: { name: string; trigger?: string | null },
 opts?: {
  prefixes?: string[][];
  excludeId?: string;
 },
) => snippetConflict.call(plugin(rows, opts?.prefixes), 'guild', data, opts?.excludeId);

const existing: Row[] = [{ id: '1', name: 'refund', trigger: '.r' }];

describe('snippetConflict', () => {
 it('passes a genuinely new snippet', async () => {
  assert.equal(await check(existing, { name: 'shipping', trigger: '.s' }), null);
 });

 it('reports a duplicate name', async () => {
  assert.equal(await check(existing, { name: 'refund' }), SnippetErrors.nameExists);
 });

 it('reports a duplicate trigger', async () => {
  assert.equal(
   await check(existing, { name: 'shipping', trigger: '.r' }),
   SnippetErrors.triggerExists,
  );
 });

 it('lets a snippet keep its own name and trigger while editing', async () => {
  assert.equal(await check(existing, { name: 'refund', trigger: '.r' }, { excludeId: '1' }), null);
 });

 it('allows a trigger that only starts with a staff-reply prefix', async () => {
  assert.equal(
   await check(existing, { name: 'report', trigger: '?report' }, { prefixes: [['?r']] }),
   null,
  );
 });

 it('reports a trigger identical to a staff-reply prefix', async () => {
  assert.equal(
   await check(existing, { name: 'reply', trigger: '?r' }, { prefixes: [['?r']] }),
   SnippetErrors.triggerPrefixConflict,
  );
 });

 it('ignores reply prefixes when no trigger is set', async () => {
  assert.equal(await check(existing, { name: 'shipping' }, { prefixes: [['.']] }), null);
 });

 it('matches names and triggers case-sensitively but prefixes case-insensitively', async () => {
  assert.equal(await check(existing, { name: 'Refund', trigger: '.X' }), null);
  assert.equal(
   await check(existing, { name: 'Refund', trigger: '.X' }, { prefixes: [['.x']] }),
   SnippetErrors.triggerPrefixConflict,
  );
 });
});
