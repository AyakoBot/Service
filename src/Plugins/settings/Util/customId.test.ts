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
 assert.equal(id, 'settings:gnav:ticketing:42:general::1::');
 assert.deepEqual(parseSettingsId(id), {
  action: SettingsAction.GroupNav,
  settingName: 'ticketing',
  rowId: '42',
  groupId: 'general',
  column: undefined,
  hideUnavail: true,
  guideFlags: undefined,
  guideSection: undefined,
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
 assert.equal(id, 'settings:set:ticketing:7:channels:category:::');
 assert.deepEqual(parseSettingsId(id), {
  action: SettingsAction.SetField,
  settingName: 'ticketing',
  rowId: '7',
  groupId: 'channels',
  column: 'category',
  hideUnavail: false,
  guideFlags: undefined,
  guideSection: undefined,
 });
});

test('round-trips a create id with no row, group, or column', () => {
 const id = encodeSettingsId({ action: SettingsAction.Create, settingName: 'ticketing' });
 assert.equal(id, 'settings:create:ticketing::::::');
 assert.deepEqual(parseSettingsId(id), {
  action: SettingsAction.Create,
  settingName: 'ticketing',
  rowId: undefined,
  groupId: undefined,
  column: undefined,
  hideUnavail: false,
  guideFlags: undefined,
  guideSection: undefined,
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
  guideFlags: undefined,
  guideSection: undefined,
 });
});

test('round-trips a guide id carrying a zero bitfield and a section', () => {
 const id = encodeSettingsId({
  action: SettingsAction.Guide,
  settingName: 'ticketing',
  rowId: '9',
  groupId: 'general',
  hideUnavail: true,
  guideFlags: 0,
  guideSection: 'channels',
 });
 assert.equal(id, 'settings:guide:ticketing:9:general::1:0:channels');
 assert.deepEqual(parseSettingsId(id), {
  action: SettingsAction.Guide,
  settingName: 'ticketing',
  rowId: '9',
  groupId: 'general',
  column: undefined,
  hideUnavail: true,
  guideFlags: 0,
  guideSection: 'channels',
 });
});

test('round-trips a guide step id carrying a set bitfield', () => {
 const id = encodeSettingsId({
  action: SettingsAction.GuideStep,
  settingName: 'ticketing',
  rowId: '9',
  groupId: 'general',
  column: 'botToken',
  hideUnavail: true,
  guideFlags: 3,
  guideSection: 'botIdentity',
 });
 const parsed = parseSettingsId(id);
 assert.equal(parsed?.guideFlags, 3);
 assert.equal(parsed?.guideSection, 'botIdentity');
});

test('rejects non-settings ids', () => {
 assert.equal(parseSettingsId('tickets/create_42'), null);
});
