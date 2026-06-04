import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EditorType } from '../EditorType.js';
import { FieldArity } from '../SettingsSchema.js';

import { ComponentKind, resolveComponentKind } from './resolveComponentKind.js';

test('boolean => checkbox-bool regardless of arity', () => {
 assert.equal(
  resolveComponentKind(EditorType.Boolean, FieldArity.Single, 0),
  ComponentKind.CheckboxBool,
 );
});

test('entity editors => entity', () => {
 assert.equal(resolveComponentKind(EditorType.Role, FieldArity.Single, 0), ComponentKind.Entity);
 assert.equal(resolveComponentKind(EditorType.Channels, FieldArity.Multi, 0), ComponentKind.Entity);
 assert.equal(resolveComponentKind(EditorType.Users, FieldArity.Multi, 0), ComponentKind.Entity);
 assert.equal(resolveComponentKind(EditorType.Mention, FieldArity.Single, 0), ComponentKind.Entity);
});

test('text editors => text', () => {
 assert.equal(resolveComponentKind(EditorType.String, FieldArity.Single, 0), ComponentKind.Text);
 assert.equal(resolveComponentKind(EditorType.Duration, FieldArity.Single, 0), ComponentKind.Text);
 assert.equal(resolveComponentKind(EditorType.Number, FieldArity.Single, 0), ComponentKind.Text);
 assert.equal(
  resolveComponentKind(EditorType.Strings, FieldArity.Multi, 0),
  ComponentKind.TextMulti,
 );
});

test('secret editors => secret-text', () => {
 assert.equal(
  resolveComponentKind(EditorType.Token, FieldArity.Single, 0),
  ComponentKind.SecretText,
 );
 assert.equal(
  resolveComponentKind(EditorType.BotToken, FieldArity.Single, 0),
  ComponentKind.SecretText,
 );
});

test('enum-backed follows the 2×2 on option count + arity', () => {
 assert.equal(
  resolveComponentKind(EditorType.TicketType, FieldArity.Single, 4),
  ComponentKind.Radio,
 );
 assert.equal(
  resolveComponentKind(EditorType.TicketType, FieldArity.Multi, 4),
  ComponentKind.CheckboxGroup,
 );
 assert.equal(
  resolveComponentKind(EditorType.Language, FieldArity.Single, 30),
  ComponentKind.Select1,
 );
 assert.equal(
  resolveComponentKind(EditorType.Language, FieldArity.Multi, 30),
  ComponentKind.SelectN,
 );
});
