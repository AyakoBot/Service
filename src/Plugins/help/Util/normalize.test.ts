import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 type APIApplicationCommand,
 type APIApplicationCommandSubcommandGroupOption,
 type APIApplicationCommandSubcommandOption,
} from 'discord-api-types/v10';

import { HelpOptionKind, HelpSource, normalizeCommands } from './normalize.js';
import { pathKey } from './path.js';

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

const contextMenu = (
 name: string,
 type: ApplicationCommandType.Message | ApplicationCommandType.User,
): APIApplicationCommand =>
 ({
  id: `id-${name}`,
  application_id: 'app',
  name,
  description: '',
  type,
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

test('a standalone command is one leaf keyed by its own name', () => {
 const surface = normalizeCommands([command('ping', 'Pong')]);

 assert.deepEqual(surface.leaves, ['ping']);
 assert.equal(surface.byPath.get('ping')?.fullName, 'ping');
 assert.deepEqual(surface.byPath.get('ping')?.path, ['ping']);
 assert.equal(surface.topLevel.length, 1);
});

test('a one-level tree yields a leaf per subcommand and lists the parent once', () => {
 const surface = normalizeCommands([
  command('info', 'Look things up', [
   subcommand('user', 'A user'),
   subcommand('role', 'A role'),
   subcommand('emoji', 'An emoji'),
  ]),
 ]);

 assert.deepEqual(surface.leaves, ['info emoji', 'info role', 'info user']);
 assert.ok(surface.byPath.has(pathKey(['info', 'role'])));
 assert.equal(surface.topLevel.length, 1);
 assert.deepEqual(surface.byPath.get('info')?.leaves, ['info emoji', 'info role', 'info user']);
});

test('a hybrid tree keeps direct subcommands and group subcommands at once', () => {
 const surface = normalizeCommands([
  command('vc', 'Voice hubs', [
   subcommand('create', 'Create'),
   subcommand('delete', 'Delete'),
   group('edit', 'Edit', [subcommand('name', 'Name'), subcommand('bitrate', 'Bitrate')]),
  ]),
 ]);

 assert.ok(surface.byPath.has('vc create'));
 assert.ok(surface.byPath.has('vc delete'));
 assert.ok(surface.byPath.has('vc edit'));
 assert.ok(surface.byPath.has('vc edit name'));
 assert.ok(surface.byPath.has('vc edit bitrate'));
 assert.equal(surface.byPath.size, 6);
 assert.deepEqual(surface.leaves, ['vc create', 'vc delete', 'vc edit bitrate', 'vc edit name']);
 assert.deepEqual(
  surface.byName.get('edit')?.map((entry) => entry.fullName),
  ['vc edit'],
 );
 assert.deepEqual(surface.byPath.get('vc edit')?.leaves, ['vc edit bitrate', 'vc edit name']);
});

test('a name used at two levels produces two paths and a two-entry byName', () => {
 const surface = normalizeCommands([
  command('self-roles', 'Pick your roles'),
  command('roles', 'Manage roles', [subcommand('self-roles', 'Make a self role')]),
 ]);

 assert.ok(surface.byPath.has('self-roles'));
 assert.ok(surface.byPath.has('roles self-roles'));
 assert.equal(surface.byName.get('self-roles')?.length, 2);
 assert.equal(surface.byPath.size, 3);
});

test('an option never becomes a leaf even when it shares a subcommand name', () => {
 const surface = normalizeCommands([
  command('emojis', 'Emojis', [
   subcommand('create', 'Create'),
   group('edit', 'Edit', [subcommand('name', 'Rename')]),
  ]),
  command('stickers', 'Stickers', [
   subcommand('create', 'Create'),
   group('edit', 'Edit', [subcommand('name', 'Rename')]),
  ]),
 ]);

 assert.ok(surface.byPath.has('emojis edit name'));
 assert.ok(surface.byPath.has('stickers edit name'));
 assert.ok(!surface.byPath.has('name'));
 assert.equal(surface.byName.get('edit')?.length, 2);
});

test('context menus are separated from the slash surface and labelled by source', () => {
 const surface = normalizeCommands([
  command('ping', 'Pong'),
  contextMenu('View Raw', ApplicationCommandType.Message),
  contextMenu('Open Ticket', ApplicationCommandType.User),
 ]);

 assert.deepEqual(surface.leaves, ['ping']);
 assert.equal(surface.topLevel.length, 1);
 assert.equal(surface.contextMenus.length, 2);
 assert.deepEqual(surface.contextMenus.map((entry) => entry.name).sort(), [
  'Open Ticket',
  'View Raw',
 ]);
 assert.equal(
  surface.contextMenus.find((entry) => entry.name === 'View Raw')?.source,
  HelpSource.MessageContext,
 );
 assert.equal(
  surface.contextMenus.find((entry) => entry.name === 'Open Ticket')?.source,
  HelpSource.UserContext,
 );
});

test('a tree parent still records its own leaves', () => {
 const surface = normalizeCommands([
  command('mod', 'Moderation', [
   subcommand('ban', 'Bans a User'),
   subcommand('kick', 'Kicks a User'),
  ]),
 ]);

 assert.deepEqual(surface.byPath.get('mod')?.leaves, ['mod ban', 'mod kick']);
 assert.ok(surface.byPath.has('mod ban'));
});

test('an option view carries its kind, its required default and its choices', () => {
 const surface = normalizeCommands([
  command('give', 'Give something away', [
   {
    name: 'amount',
    description: 'How much',
    type: ApplicationCommandOptionType.Integer,
    choices: [
     { name: 'None', value: 0 },
     { name: 'Ten', value: 10 },
     { name: 'Twenty Five', value: 25 },
    ],
   },
   {
    name: 'reason',
    description: 'Why',
    type: ApplicationCommandOptionType.String,
    required: true,
   },
   {
    name: 'proof',
    description: 'A Screenshot',
    type: ApplicationCommandOptionType.Attachment,
   },
  ]),
 ]);

 const options = surface.byPath.get('give')?.options ?? [];

 assert.deepEqual(
  options.map((option) => option.choices),
  [['0', '10', '25'], null, null],
 );
 assert.deepEqual(
  options.map((option) => option.required),
  [false, true, false],
 );
 assert.deepEqual(
  options.map((option) => option.kind),
  [HelpOptionKind.Number, HelpOptionKind.Text, HelpOptionKind.Attachment],
 );
});

test('every basic option type maps to its own kind', () => {
 const expected: [ApplicationCommandOptionType, HelpOptionKind][] = [
  [ApplicationCommandOptionType.Attachment, HelpOptionKind.Attachment],
  [ApplicationCommandOptionType.Boolean, HelpOptionKind.Boolean],
  [ApplicationCommandOptionType.Channel, HelpOptionKind.Channel],
  [ApplicationCommandOptionType.Integer, HelpOptionKind.Number],
  [ApplicationCommandOptionType.Mentionable, HelpOptionKind.Mentionable],
  [ApplicationCommandOptionType.Number, HelpOptionKind.Number],
  [ApplicationCommandOptionType.Role, HelpOptionKind.Role],
  [ApplicationCommandOptionType.String, HelpOptionKind.Text],
  [ApplicationCommandOptionType.User, HelpOptionKind.User],
 ];

 const surface = normalizeCommands([
  command(
   'kinds',
   'One Option per Type',
   expected.map(([type], index) => ({
    name: `option-${index}`,
    description: 'An Option',
    type,
   })) as APIApplicationCommand['options'],
  ),
 ]);

 assert.deepEqual(
  (surface.byPath.get('kinds')?.options ?? []).map((option) => option.kind),
  expected.map(([, kind]) => kind),
 );
});
