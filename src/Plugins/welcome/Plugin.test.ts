import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type Client from '../../Classes/Client.js';
import rewardsSchema from '../economy/Classes/rewardsSchema.js';
import { EditorType } from '../settings/EditorType.js';
import { assertSchemaValid } from '../settings/SettingsSchema.js';

import WelcomePlugin from './Plugin.js';

const stubClient = () =>
 ({
  cache: { on: () => undefined, scheduleDb: undefined },
  db: { client: {} },
 }) as unknown as Client;

describe('saved design pickers', () => {
 const plugin = new WelcomePlugin(stubClient());

 it('keep the welcome schema and its goodbye view valid', () => {
  assert.doesNotThrow(() => assertSchemaValid(plugin.settingsSchema));
  Object.values(plugin.extraSchemas).forEach((schema) => {
   assert.doesNotThrow(() => assertSchemaValid(schema));
  });
 });

 it('keep the economy reward schema valid', () => {
  assert.doesNotThrow(() => assertSchemaValid(rewardsSchema));
 });

 it('replace every embed and components text field with one picker', () => {
  const columns = [plugin.settingsSchema, rewardsSchema].flatMap((schema) =>
   schema.groups.flatMap((group) => group.fields),
  );

  assert.deepEqual(
   columns.filter((field) => field.editor === EditorType.SavedDesign).map((field) => field.column),
   ['welcomeDesign', 'goodbyeDesign', 'panelDesign'],
  );
  assert.ok(
   !columns.some((field) => /(Embed|Components|^embed|^components)$/.test(field.column)),
  );
 });
});
