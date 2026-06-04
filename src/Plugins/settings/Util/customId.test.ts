import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SettingsAction, encodeSettingsId, parseSettingsId } from './customId.js';

test('round-trips a group id', () => {
 const id = encodeSettingsId({ action: SettingsAction.Group, settingName: 'ticketing', rowId: '42', groupId: 'general' });
 assert.equal(id, 'settings:group:ticketing:42:general');
 assert.deepEqual(parseSettingsId(id), {
  action: SettingsAction.Group, settingName: 'ticketing', rowId: '42', groupId: 'general',
 });
});

test('parses a create id with no row or group', () => {
 assert.deepEqual(parseSettingsId('settings:create:ticketing'), {
  action: SettingsAction.Create, settingName: 'ticketing', rowId: undefined, groupId: undefined,
 });
});

test('rejects non-settings ids', () => {
 assert.equal(parseSettingsId('tickets/create_42'), null);
});
