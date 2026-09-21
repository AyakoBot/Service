import assert from 'node:assert/strict';
import { test } from 'node:test';

import type Client from '../../../Classes/Client.js';
import AFKPlugin from '../../afk/Plugin.js';
import RpPlugin from '../../rp/Plugin.js';
import SettingsPlugin from '../../settings/Plugin.js';
import HelpPlugin from '../Plugin.js';

import localSurface from './localSurface.js';

const unowned = 'unowned-application-id';

const baseAppId = '650691698409734151';

const tokenFor = (id: string): string => `Bot ${Buffer.from(id).toString('base64')}.segment.sig`;

const stubClient = (plugins: unknown[]): Client =>
 ({
  plugins,
  getBaseAPI: () => ({ botId: baseAppId }),
 }) as unknown as Client;

const emptyClient = stubClient([]);

const helpPlugin = new HelpPlugin(emptyClient);
const afkPlugin = new AFKPlugin(emptyClient);
const rpPlugin = new RpPlugin(emptyClient);
const settingsPlugin = new SettingsPlugin(emptyClient);

const namesOf = (commands: { name: string }[]): string[] =>
 commands.map((command) => command.name).sort();

test('an unowned application gets the whole registered surface', () => {
 const surface = localSurface.call(stubClient([helpPlugin, afkPlugin]), unowned);

 assert.deepEqual(namesOf(surface.commands), ['afk', 'help', 'plugins', 'settings']);
});

test('a declared token owner gets only its own closure plus universal commands', () => {
 process.env.AFK_TOKEN = tokenFor('111111111111111111');

 try {
  const surface = localSurface.call(
   stubClient([helpPlugin, afkPlugin, settingsPlugin]),
   '111111111111111111',
  );

  assert.deepEqual(namesOf(surface.commands), ['afk', 'help', 'plugins', 'settings']);
 } finally {
  delete process.env.AFK_TOKEN;
 }
});

test('an owner carries the settings entry it declares and nothing else', () => {
 process.env.AFK_TOKEN = tokenFor('111111111111111111');

 try {
  const surface = localSurface.call(
   stubClient([helpPlugin, afkPlugin, settingsPlugin]),
   '111111111111111111',
  );

  const settings = surface.commands.find((command) => command.name === 'settings');
  const groups = (settings?.options ?? []).map((option) => option.name);

  assert.deepEqual(groups, ['general']);
 } finally {
  delete process.env.AFK_TOKEN;
 }
});

test('a second owner resolves through its own token', () => {
 process.env.RP_TOKEN = tokenFor('222222222222222222');

 try {
  const surface = localSurface.call(
   stubClient([helpPlugin, rpPlugin, settingsPlugin]),
   '222222222222222222',
  );

  assert.ok(namesOf(surface.commands).includes('rp'));
  assert.ok(!namesOf(surface.commands).includes('afk'));
 } finally {
  delete process.env.RP_TOKEN;
 }
});

test('an owner closure excludes unrelated plugins', () => {
 process.env.AFK_TOKEN = tokenFor('111111111111111111');

 try {
  const surface = localSurface.call(
   stubClient([helpPlugin, afkPlugin, settingsPlugin, rpPlugin]),
   '111111111111111111',
  );

  assert.ok(!namesOf(surface.commands).includes('ping'));
  assert.ok(!namesOf(surface.commands).includes('rp'));
 } finally {
  delete process.env.AFK_TOKEN;
 }
});
