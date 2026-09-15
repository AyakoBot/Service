import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 type APIApplicationCommand,
 type APIApplicationCommandSubcommandGroupOption,
 type APIApplicationCommandSubcommandOption,
} from 'discord-api-types/v10';

import { normalizeCommands } from './normalize.js';
import { MatchKind, resolveCommand } from './match.js';

const command = (
 name: string,
 description: string,
 options?: APIApplicationCommand['options'],
): APIApplicationCommand =>
 ({
  id: `id-${name}`,
  application_id: 'app',
  name,
  description,
  type: ApplicationCommandType.ChatInput,
  options,
 }) as APIApplicationCommand;

const subcommand = (name: string, description: string): APIApplicationCommandSubcommandOption => ({
 name,
 description,
 type: ApplicationCommandOptionType.Subcommand,
});

const group = (
 name: string,
 description: string,
 options: APIApplicationCommandSubcommandOption[],
): APIApplicationCommandSubcommandGroupOption => ({
 name,
 description,
 type: ApplicationCommandOptionType.SubcommandGroup,
 options,
});

const surface = normalizeCommands([
 command('mod', 'Moderation Commands', [
  subcommand('ban', 'Bans a User'),
  subcommand('kick', 'Kicks a User'),
  group('clear', 'Bulk-Delete Messages', [
   subcommand('all', 'Delete the last Messages'),
   subcommand('user', 'Delete Messages of a User'),
  ]),
 ]),
 command('self-roles', 'Pick your own Roles'),
 command('roles', 'Manage Roles', [subcommand('self-roles', 'Make a self role')]),
 command('ping', 'Pong'),
]);

test('an exact leaf path resolves exactly', () => {
 const result = resolveCommand(surface, 'mod clear all');

 assert.equal(result.kind, MatchKind.Exact);
 assert.equal(result.target?.fullName, 'mod clear all');
});

test('a subcommand group resolves as an exact path', () => {
 const result = resolveCommand(surface, 'mod clear');

 assert.equal(result.kind, MatchKind.Exact);
 assert.equal(result.target?.fullName, 'mod clear');
 assert.deepEqual(result.target?.leaves, ['mod clear all', 'mod clear user']);
});

test('a top level name resolves exactly', () => {
 const result = resolveCommand(surface, 'mod');

 assert.equal(result.kind, MatchKind.Exact);
 assert.equal(result.target?.fullName, 'mod');
});

test('a bare subcommand name resolves through the name index', () => {
 const result = resolveCommand(surface, 'ping');

 assert.equal(result.kind, MatchKind.Exact);
 assert.equal(result.target?.fullName, 'ping');

 const named = resolveCommand(surface, 'all');

 assert.equal(named.kind, MatchKind.Name);
 assert.equal(named.target?.fullName, 'mod clear all');
});

test('a colliding name resolves to the slash entry', () => {
 const result = resolveCommand(surface, 'self-roles');

 assert.ok(result.target);
 assert.equal(result.target.fullName, 'self-roles');
 assert.equal(result.target.description, 'Pick your own Roles');
});

test('a typo resolves fuzzily and reports the closest name', () => {
 const result = resolveCommand(surface, 'bann');

 assert.equal(result.kind, MatchKind.Fuzzy);
 assert.ok(result.closest);
 assert.equal(result.target?.fullName, 'mod ban');
});

test('an unknown query yields no target and never crashes', () => {
 const result = resolveCommand(surface, 'zzzzz');

 assert.ok(result.kind === MatchKind.Fuzzy || result.kind === MatchKind.None);
 assert.ok(result.target === null || result.target.fullName.length > 0);
});

test('an empty query is a plain miss', () => {
 const result = resolveCommand(surface, '   ');

 assert.equal(result.kind, MatchKind.None);
 assert.equal(result.target, null);
});
