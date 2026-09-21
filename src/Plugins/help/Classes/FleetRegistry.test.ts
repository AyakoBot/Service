import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PluginBotKey } from '../../../Util/pluginBotKey.js';
import { FleetBot } from './Commands.js';
import { fleetEntries } from './FleetRegistry.js';

test('every fleet bot has exactly one registry entry', () => {
 const entries = fleetEntries();
 const bots = entries.map((entry) => entry.bot);

 Object.values(FleetBot).forEach((bot) => {
  assert.equal(
   bots.filter((candidate) => candidate === bot).length,
   1,
   `missing or duplicated registry entry for ${bot}`,
  );
 });

 assert.equal(entries.length, Object.values(FleetBot).length);
});

test('fleet bots stay in step with the plugin bot keys', () => {
 const expected: Record<FleetBot, PluginBotKey> = {
  [FleetBot.Base]: PluginBotKey.Base,
  [FleetBot.Afk]: PluginBotKey.Afk,
  [FleetBot.CustomRoles]: PluginBotKey.CustomRoles,
  [FleetBot.Economy]: PluginBotKey.Economy,
  [FleetBot.Info]: PluginBotKey.Info,
  [FleetBot.Rp]: PluginBotKey.Rp,
  [FleetBot.Ticketing]: PluginBotKey.Ticketing,
  [FleetBot.Welcome]: PluginBotKey.Welcome,
 };

 fleetEntries().forEach((entry) => {
  assert.equal(entry.tokenKey, expected[entry.bot]);
 });
});

test('a bot without an environment token resolves to no app id', () => {
 const saved = process.env[PluginBotKey.Info];
 delete process.env[PluginBotKey.Info];

 try {
  const entry = fleetEntries().find((candidate) => candidate.bot === FleetBot.Info);

  assert.ok(entry);
  assert.equal(entry.appId, null);
 } finally {
  if (saved !== undefined) process.env[PluginBotKey.Info] = saved;
 }
});

test('a synthetic token resolves to its decoded application id', () => {
 const appId = '123456789012345678';
 const saved = process.env[PluginBotKey.Info];
 process.env[PluginBotKey.Info] = `Bot ${Buffer.from(appId).toString('base64')}.segment.sig`;

 try {
  const entry = fleetEntries().find((candidate) => candidate.bot === FleetBot.Info);

  assert.ok(entry);
  assert.equal(entry.appId, appId);
 } finally {
  if (saved === undefined) delete process.env[PluginBotKey.Info];
  else process.env[PluginBotKey.Info] = saved;
 }
});
