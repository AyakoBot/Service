import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EditorType } from '../EditorType.js';
import type { SettingsField } from '../SettingsSchema.js';

import { InlineKind, resolveInlineKind } from './resolveInlineKind.js';

const withOptions = (editor: EditorType): SettingsField =>
 ({
  column: 'c',
  editor,
  label: 'c',
  options: [
   { label: 'A', value: 'a' },
   { label: 'B', value: 'b' },
  ],
 }) as SettingsField;

test('option fields render inline as a select', () => {
 assert.equal(resolveInlineKind(withOptions(EditorType.ShopType)), InlineKind.Select);
});

test('saved design pickers open a modal even with options', () => {
 assert.equal(resolveInlineKind(withOptions(EditorType.SavedDesign)), InlineKind.ModalText);
});
