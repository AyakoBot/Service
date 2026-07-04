import assert from 'node:assert/strict';
import { test } from 'node:test';

import type Client from '../Classes/Client.js';

import resolvePluginDependencies from './resolvePluginDependencies.js';

type StubPlugin = { settingName: string; dependencies: string[] };

const clientWith = (plugins: StubPlugin[]) => ({ plugins }) as unknown as Client;

test('returns root first then breadth-first dependencies', () => {
 const settings = { settingName: 'settings', dependencies: [] };
 const embed = { settingName: 'embed-builder', dependencies: ['settings'] };
 const component = { settingName: 'component-builder', dependencies: ['settings'] };
 const ticketing = {
  settingName: 'ticketing',
  dependencies: ['settings', 'embed-builder', 'component-builder'],
 };
 const client = clientWith([settings, embed, component, ticketing]);

 const resolved = resolvePluginDependencies(client, ticketing as never);
 assert.deepEqual(
  resolved.map((plugin) => plugin.settingName),
  ['ticketing', 'settings', 'embed-builder', 'component-builder'],
 );
});

test('deduplicates diamond dependencies', () => {
 const settings = { settingName: 'settings', dependencies: [] };
 const embed = { settingName: 'embed-builder', dependencies: ['settings'] };
 const component = { settingName: 'component-builder', dependencies: ['settings'] };
 const ticketing = {
  settingName: 'ticketing',
  dependencies: ['embed-builder', 'component-builder'],
 };
 const client = clientWith([settings, embed, component, ticketing]);

 const names = resolvePluginDependencies(client, ticketing as never).map(
  (plugin) => plugin.settingName,
 );
 assert.deepEqual(names, ['ticketing', 'embed-builder', 'component-builder', 'settings']);
 assert.equal(new Set(names).size, names.length);
});

test('is cycle-safe', () => {
 const a = { settingName: 'a', dependencies: ['b'] };
 const b = { settingName: 'b', dependencies: ['a'] };
 const client = clientWith([a, b]);

 const names = resolvePluginDependencies(client, a as never).map((plugin) => plugin.settingName);
 assert.deepEqual(names, ['a', 'b']);
});

test('root with no dependencies resolves to itself', () => {
 const afk = { settingName: 'afk', dependencies: [] };
 const settings = { settingName: 'settings', dependencies: [] };
 const client = clientWith([afk, settings]);

 assert.deepEqual(
  resolvePluginDependencies(client, afk as never).map((plugin) => plugin.settingName),
  ['afk'],
 );
});

test('throws on unknown dependency', () => {
 const afk = { settingName: 'afk', dependencies: ['ghost'] };
 const client = clientWith([afk]);

 assert.throws(
  () => resolvePluginDependencies(client, afk as never),
  /unknown dependency "ghost"/,
 );
});
