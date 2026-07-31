import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EditorType } from './EditorType.js';
import { assertSchemaValid, type SettingsSchemaDef } from './SettingsSchema.js';

const field = (column: string) => ({ column, editor: EditorType.Boolean, label: () => column });

test('passes a schema whose groups each have <= 10 fields', () => {
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

test('throws when a group exceeds 10 fields', () => {
 assert.throws(
  () =>
   assertSchemaValid({
    table: 'ticketSetting',
    rowKey: 'id',
    multiRow: true,
    rowLabel: () => 'x',
    groups: [
     {
      id: 'g',
      label: () => 'G',
      fields: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'].map(field),
     },
    ],
   }),
  /10 fields/,
 );
});

const baseSchema = (field: Record<string, unknown>, guideColumn?: string): SettingsSchemaDef =>
 ({
  table: 'ticketSetting',
  rowKey: 'id',
  multiRow: true,
  rowLabel: () => 'row',
  groups: [{ id: 'g', label: () => 'G', fields: [field] }],
  ...(guideColumn
   ? {
      guide: {
       title: () => 'T',
       advert: { text: () => 'a', buttonLabel: () => 'b' },
       sections: [
        { id: 's', label: () => 'S', steps: [{ column: guideColumn, label: () => 'L' }] },
       ],
      },
     }
   : {}),
 }) as unknown as SettingsSchemaDef;

const virtualField = {
 column: 'profileNick',
 editor: EditorType.String,
 label: () => 'Nickname',
 virtual: { read: async () => null, write: async () => ({ ok: true }) },
};

test('accepts a well-formed virtual field', () => {
 assert.doesNotThrow(() => assertSchemaValid(baseSchema(virtualField)));
});

test('rejects a virtual field missing write', () => {
 const broken = { ...virtualField, virtual: { read: async () => null } };
 assert.throws(() => assertSchemaValid(baseSchema(broken)), /must define both 'read' and 'write'/);
});

test('rejects a guide step that references a virtual field', () => {
 assert.throws(
  () => assertSchemaValid(baseSchema(virtualField, 'profileNick')),
  /references virtual column 'profileNick'/,
 );
});

test('rejects a required virtual field', () => {
 assert.throws(
  () => assertSchemaValid(baseSchema({ ...virtualField, required: true })),
  /is virtual and cannot be required/,
 );
});
