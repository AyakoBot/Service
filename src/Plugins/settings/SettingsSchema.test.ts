import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EditorType } from './EditorType.js';
import { assertSchemaValid } from './SettingsSchema.js';

const field = (column: string) => ({ column, editor: EditorType.Boolean, label: () => column });

test('passes a schema whose groups each have <= 5 fields', () => {
 assert.doesNotThrow(() =>
  assertSchemaValid({
   table: 'ticketSetting',
   rowKey: 'id',
   multiRow: true,
   rowLabel: () => 'x',
   groups: [{ id: 'g', label: () => 'G', fields: [field('a'), field('b')] }],
  }),
 );
});

test('throws when a group exceeds 5 fields', () => {
 assert.throws(
  () =>
   assertSchemaValid({
    table: 'ticketSetting',
    rowKey: 'id',
    multiRow: true,
    rowLabel: () => 'x',
    groups: [{ id: 'g', label: () => 'G', fields: ['a', 'b', 'c', 'd', 'e', 'f'].map(field) }],
   }),
  /5 fields/,
 );
});
