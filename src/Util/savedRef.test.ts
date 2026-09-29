import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { OptionsResolver, RowGuardContext } from '../Plugins/settings/SettingsSchema.js';

import { noSavedDesign, savedDesignField } from './savedRef.js';

interface Design {
 id: string;
 name: string;
 components?: unknown[];
}

const matches = (design: Design, where: Record<string, unknown>): boolean =>
 (where.id === undefined || design.id === where.id) &&
 (where.name === undefined || design.name === where.name);

const stub = (embeds: Design[], components: Design[]) => {
 const updates: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
 const table = (rows: Design[]) => ({
  findMany: async () => rows,
  findFirst: async ({ where }: { where: Record<string, unknown> }) =>
   rows.find((row) => matches(row, where)) ?? null,
 });

 const ctx = {
  guildId: 'G1',
  client: {
   db: {
    client: {
     customEmbed: table(embeds),
     customComponents: table(components),
     welcomeSetting: {
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
       updates.push(args);
       return { count: 1 };
      },
     },
    },
   },
  },
  plugin: {
   t: async () => ({
    base: {
     t: { None: () => 'None' },
     savedDesigns: {
      embed: () => 'Embed',
      components: () => 'Components V2',
      truncated: ({ shown, total }: { shown: string; total: string }) => `${shown} of ${total}`,
      notFound: () => 'Gone',
      tooLarge: ({ count, limit }: { count: string; limit: string }) => `${count} > ${limit}`,
      tooLargeReason: ({ count, limit }: { count: string; limit: string }) =>
       `Too big: ${count} > ${limit}`,
     },
    },
   }),
  },
 } as unknown as RowGuardContext;

 return { ctx, updates };
};

const field = savedDesignField('welcomeSetting', {
 embed: 'welcomeEmbed',
 components: 'welcomeComponents',
});

const options = (ctx: RowGuardContext) => (field.options as OptionsResolver)(ctx);

test('lists None first, then every saved design newest first with its kind', async () => {
 const { ctx } = stub(
  [{ id: '100', name: 'Old card' }, { id: '300', name: 'New card' }],
  [{ id: '200', name: 'Layout' }],
 );

 assert.deepEqual(await options(ctx), [
  { label: 'None', value: noSavedDesign },
  { label: 'New card', value: 'e:300', description: 'Embed' },
  { label: 'Layout', value: 'c:200', description: 'Components V2' },
  { label: 'Old card', value: 'e:100', description: 'Embed' },
 ]);
});

test('caps the list at 25 options and says so on None', async () => {
 const embeds = Array.from({ length: 30 }, (_, index) => ({
  id: String(1000 + index),
  name: `Design ${index}`,
 }));
 const listed = await options(stub(embeds, []).ctx);

 assert.equal(listed.length, 25);
 assert.deepEqual(listed[0], { label: 'None', value: noSavedDesign, description: '24 of 30' });
 assert.equal(listed[1]?.value, 'e:1029');
});

test('reads back whichever column is set, components first', async () => {
 const { ctx } = stub([{ id: '1', name: 'Card' }], [{ id: '2', name: 'Layout' }]);
 const read = field.virtual!.read;

 assert.equal(await read({ welcomeEmbed: 'Card', welcomeComponents: null }, ctx), 'e:1');
 assert.equal(await read({ welcomeEmbed: null, welcomeComponents: 'Layout' }, ctx), 'c:2');
 assert.equal(await read({ welcomeEmbed: null, welcomeComponents: null }, ctx), '');
 assert.equal(await read({ welcomeEmbed: 'Deleted', welcomeComponents: null }, ctx), '');
});

test('stores the picked name in its column and clears the other', async () => {
 const { ctx, updates } = stub([{ id: '1', name: 'Card' }], [{ id: '2', name: 'Layout' }]);
 const row = { id: 'R1', welcomeEmbed: 'Card', welcomeComponents: null };

 assert.deepEqual(await field.virtual!.write('c:2', row, ctx), { ok: true });
 assert.deepEqual(await field.virtual!.write(noSavedDesign, row, ctx), { ok: true });
 assert.deepEqual(updates, [
  { where: { id: 'R1', guild: 'G1' }, data: { welcomeEmbed: null, welcomeComponents: 'Layout' } },
  { where: { id: 'R1', guild: 'G1' }, data: { welcomeEmbed: null, welcomeComponents: null } },
 ]);
});

test('refuses a design that no longer exists and writes nothing', async () => {
 const { ctx, updates } = stub([], []);

 assert.deepEqual(await field.virtual!.write('e:9', { id: 'R1' }, ctx), { ok: false, reason: 'Gone' });
 assert.equal(updates.length, 0);
});

const components = (count: number) =>
 Array.from({ length: count }, () => ({ type: 10, content: 'x' }));

test('marks and refuses a components design too large for the spot', async () => {
 const reserved = savedDesignField('welcomeSetting', {
  embed: 'welcomeEmbed',
  components: 'welcomeComponents',
 }, 2);
 const { ctx, updates } = stub(
  [],
  [
   { id: '2', name: 'Fits', components: components(38) },
   { id: '1', name: 'Huge', components: components(39) },
  ],
 );

 const listed = await (reserved.options as OptionsResolver)(ctx);
 assert.deepEqual(listed.slice(1), [
  { label: 'Fits', value: 'c:2', description: 'Components V2' },
  { label: 'Huge', value: 'c:1', description: 'Components V2 · 39 > 38' },
 ]);

 assert.deepEqual(await reserved.virtual.write('c:1', { id: 'R1' }, ctx), {
  ok: false,
  reason: 'Too big: 39 > 38',
 });
 assert.deepEqual(await reserved.virtual.write('c:2', { id: 'R1' }, ctx), { ok: true });
 assert.equal(updates.length, 1);
});
