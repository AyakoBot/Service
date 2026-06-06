import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SettingsAction, encodeSettingsId, parseSettingsId } from './customId.js';

test('round-trips a group navigation id', () => {
 const id = encodeSettingsId({
  action: SettingsAction.GroupNav,
  settingName: 'ticketing',
  rowId: '42',
  groupId: 'general',
  hideUnavail: true,
 });
 assert.equal(id, 'settings:gnav:ticketing:42:general::1');
 assert.deepEqual(parseSettingsId(id), {
  action: SettingsAction.GroupNav,
  settingName: 'ticketing',
  rowId: '42',
  groupId: 'general',
  column: undefined,
  hideUnavail: true,
 });
});

test('round-trips a set-field id with a column', () => {
 const id = encodeSettingsId({
  action: SettingsAction.SetField,
  settingName: 'ticketing',
  rowId: '7',
  groupId: 'channels',
  column: 'category',
  hideUnavail: false,
 });
 assert.equal(id, 'settings:set:ticketing:7:channels:category:');
 assert.deepEqual(parseSettingsId(id), {
  action: SettingsAction.SetField,
  settingName: 'ticketing',
  rowId: '7',
  groupId: 'channels',
  column: 'category',
  hideUnavail: false,
 });
});

test('round-trips a create id with no row, group, or column', () => {
 const id = encodeSettingsId({ action: SettingsAction.Create, settingName: 'ticketing' });
 assert.equal(id, 'settings:create:ticketing::::');
 assert.deepEqual(parseSettingsId(id), {
  action: SettingsAction.Create,
  settingName: 'ticketing',
  rowId: undefined,
  groupId: undefined,
  column: undefined,
  hideUnavail: false,
 });
});

test('round-trips a field modal id', () => {
 const id = encodeSettingsId({
  action: SettingsAction.FieldModal,
  settingName: 'ticketing',
  rowId: '3',
  groupId: 'forum',
  column: 'createTags',
  hideUnavail: true,
 });
 assert.deepEqual(parseSettingsId(id), {
  action: SettingsAction.FieldModal,
  settingName: 'ticketing',
  rowId: '3',
  groupId: 'forum',
  column: 'createTags',
  hideUnavail: true,
 });
});

test('rejects non-settings ids', () => {
 assert.equal(parseSettingsId('tickets/create_42'), null);
});
