import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EditorType } from '../EditorType.js';
import { FieldArity, type SettingsField } from '../SettingsSchema.js';

import { renderField } from './renderField.js';

const options = Array.from({ length: 6 }, (_, i) => ({ label: `Option ${i}`, value: `o${i}` }));

const selectOf = (field: SettingsField) =>
 renderField(field, {}).toJSON().component as { min_values?: number; required?: boolean };

test('clearable modal selects are not required', () => {
 const fields: SettingsField[] = [
  { column: 'role', editor: EditorType.Role, label: 'Role' },
  { column: 'channels', editor: EditorType.Channels, label: 'Channels', arity: FieldArity.Multi },
  { column: 'language', editor: EditorType.Language, label: 'Language', options },
  {
   column: 'languages',
   editor: EditorType.Language,
   label: 'Languages',
   arity: FieldArity.Multi,
   options,
  },
 ];

 for (const field of fields) {
  assert.deepEqual(
   { column: field.column, ...selectOf(field) },
   { column: field.column, ...selectOf(field), min_values: 0, required: false },
  );
 }
});
