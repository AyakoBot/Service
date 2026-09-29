import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type Client from '../../Classes/Client.js';
import { EditorType } from '../settings/EditorType.js';
import { FieldArity, assertSchemaValid } from '../settings/SettingsSchema.js';

import ConfessionsPlugin from './Plugin.js';

const stubClient = () =>
 ({
  cache: { on: () => undefined, scheduleDb: undefined },
  db: { client: {} },
 }) as unknown as Client;

describe('confessions plugin wiring', () => {
 const plugin = new ConfessionsPlugin(stubClient());

 it('constructs and passes settings schema validation', () => {
  assert.doesNotThrow(() => assertSchemaValid(plugin.settingsSchema));
 });

 it('keeps every group within the ten field modal limit', () => {
  plugin.settingsSchema.groups.forEach((group) => {
   assert.ok(
    group.fields.length <= 10,
    `group ${group.id} has ${group.fields.length} fields`,
   );
  });
 });

 it('stores every role and user multi-select as a list', () => {
  const lists = plugin.settingsSchema.groups
   .flatMap((group) => group.fields)
   .filter((field) => field.editor === EditorType.Roles || field.editor === EditorType.Users);

  assert.ok(lists.length > 0);
  lists.forEach((field) => assert.equal(field.arity, FieldArity.Multi, field.column));
 });

 it('offers the confession placeholders and never the member ones', () => {
  const offered: string[] = plugin.placeholders ?? [];

  assert.ok(offered.includes('confession'));
  assert.ok(offered.includes('number'));
  ['user', 'username', 'displayname', 'userid', 'useravatar', 'usercreated'].forEach(
   (member) => assert.ok(!offered.includes(member), member),
  );
 });

 it('declares the identity the register-commands plugin flag resolves', () => {
  assert.equal(plugin.settingName, 'confessions');
  assert.equal(plugin.name, 'Confessions');
  assert.equal(plugin.tableName, 'ConfessionSetting');
 });

 it('registers its own plugin bot token key', () => {
  assert.equal(
   (plugin as unknown as { pluginBotKey?: string }).pluginBotKey,
   'CONFESSIONS_TOKEN',
  );
 });

 it('exposes the confess and confession-bans commands', () => {
  const { commands, settings } = plugin.getCommands();

  assert.deepEqual(
   commands.map((command) => command.toJSON().name),
   ['confess', 'confession-bans'],
  );
  assert.equal(settings[0]?.commands[0]?.toJSON().name, 'confessions');
 });
});
