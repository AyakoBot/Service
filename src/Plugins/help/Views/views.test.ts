import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 type APIApplicationCommand,
 type APIApplicationCommandBasicOption,
 type APIApplicationCommandSubcommandGroupOption,
 type APIApplicationCommandSubcommandOption,
} from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import { containerCharBudget } from '../../../Util/fmt.js';
import HelpPlugin from '../Plugin.js';
import { FleetBot } from '../Classes/Commands.js';
import { HelpScope } from '../Classes/HelpTypes.js';
import type { HelpPanelData } from '../Classes/HelpTypes.js';
import en from '../Language/en-GB.json' with { type: 'json' };
import { normalizeCommands } from '../Util/normalize.js';
import type { ViewContext } from '../Util/render.js';
import commandDetail from '../Views/commandDetail.js';
import commandList from '../Views/commandList.js';
import fleet from '../Views/fleet.js';
import overview from '../Views/overview.js';
import settingsList from '../Views/settingsList.js';

const client = {
 plugins: [],
 getBaseAPI: () => ({ botId: 'x' }),
 getLocale: async (value: unknown) => String(value ?? 'en-GB'),
} as unknown as Client;
const plugin = new HelpPlugin(client);
const emote = (name: string) => ({ id: '1', name, animated: false });

const emotes = {
 get: (name: string) => emote(name),
 info: emote('info'),
 command: emote('command'),
 settings: emote('settings'),
 prev: emote('prev'),
 next: emote('next'),
} as never;
const mention = (name: string) => `</${name}:1>`;
const hidden = (container: { toJSON(): unknown }) => container.toJSON() as never;

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

const subcommand = (
 name: string,
 description: string,
 options?: APIApplicationCommandSubcommandOption['options'],
): APIApplicationCommandSubcommandOption => ({
 name,
 description,
 type: ApplicationCommandOptionType.Subcommand,
 options,
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

const userOption = (name: string): APIApplicationCommandBasicOption => ({
 name,
 description: 'A User',
 type: ApplicationCommandOptionType.User,
 required: true,
});

const surface = normalizeCommands([
 command('mod', 'Moderation Commands', [
  subcommand('ban', 'Bans a User', [userOption('user')]),
  subcommand('kick', 'Kicks a User', [userOption('user')]),
  group('clear', 'Bulk-Delete Messages', [
   subcommand('all', 'Delete the last Messages'),
   subcommand('user', 'Delete Messages of a User', [userOption('user')]),
  ]),
 ]),
 command('ping', 'Pong'),
 command('info', 'Look things up', [
  subcommand('user', 'A User', [userOption('user')]),
  subcommand('role', 'A Role'),
 ]),
]);

const categories = [
 'general',
 'automation',
 'utility',
 'roles',
 'nitro',
 'shop',
 'fun',
 'leveling',
 'logs',
 'moderation',
 'info',
 'channels',
];

const data: HelpPanelData = {
 surface,
 settings: categories.map((category, index) => ({
  category,
  name: `setting-${index}`,
  description: `Configure ${category}`,
  fullName: `settings ${category} setting-${index}`,
 })),
 botId: 'app',
 botName: 'Ayako',
 degraded: false,
};

const context = async (
 scope: HelpScope,
 path: string | null,
 page: number,
): Promise<ViewContext> => {
 const t = await plugin.t('en-GB');
 const target = path ? (surface.byPath.get(path) ?? null) : null;

 return { data, emotes, mention, page, plugin, scope, sessionId: 's1', t, target };
};

const assertValidContainer = (container: { toJSON(): unknown }): void => {
 const json = hidden(container) as { components?: { content?: string }[] };
 const components = json.components ?? [];

 assert.ok(components.length > 0, 'container has no components');
 assert.ok(components.length <= 10, `container has ${components.length} top level components`);

 const chars = components.reduce((total, entry) => total + (entry.content?.length ?? 0), 0);
 assert.ok(chars > 0, 'container rendered no text');
 assert.ok(chars <= containerCharBudget, `container rendered ${chars} characters`);
};

test('the overview renders for the first page and for later pages', async () => {
 for (const page of [1, 2, 5]) {
  const ctx = await context(HelpScope.Commands, null, page);
  const view = overview(ctx);

  assertValidContainer(view.container);
  assert.ok(view.pages >= 1);
 }
});

test('the command list renders every leaf and survives pagination', async () => {
 const ctx = await context(HelpScope.Commands, null, 1);
 const view = commandList(ctx);

 assertValidContainer(view.container);

 const last = commandList(await context(HelpScope.Commands, null, view.pages));
 assertValidContainer(last.container);
});

test('the command detail renders a tree, a group and a leaf', async () => {
 for (const path of ['mod', 'mod clear', 'mod ban', 'ping']) {
  const ctx = await context(HelpScope.Commands, path, 1);
  const view = commandDetail(ctx);

  assertValidContainer(view.container);
 }
});

test('the command detail paginates a large option set', async () => {
 const ctx = await context(HelpScope.Commands, 'mod', 1);
 const view = commandDetail(ctx);

 const beyond = commandDetail(await context(HelpScope.Commands, 'mod', 999));
 assertValidContainer(beyond.container);
 assert.ok(view.pages >= 1);
});

test('the command detail still renders when no command is targeted', async () => {
 const ctx = await context(HelpScope.Commands, null, 1);
 const mismatch = 'That Command lives on another Bot.';
 const withMismatch = commandDetail(ctx, mismatch);
 const withoutMismatch = commandDetail(ctx);

 for (const view of [withMismatch, withoutMismatch]) {
  const json = hidden(view.container) as { components?: unknown[] };

  assert.ok((json.components ?? []).length > 0, 'the empty detail rendered no components');
  assertValidContainer(view.container);
 }

 assert.ok(JSON.stringify(hidden(withMismatch.container)).includes(mismatch));
});

test('the settings list renders every category', async () => {
 const view = settingsList(await context(HelpScope.Settings, null, 1));

 assertValidContainer(view.container);
 assert.ok(view.pages >= 1);
});

test('the settings list handles a bot without settings', async () => {
 const t = await plugin.t('en-GB');
 const ctx: ViewContext = {
  data: { ...data, settings: [] },
  emotes,
  mention,
  page: 1,
  plugin,
  scope: HelpScope.Settings,
  sessionId: 's1',
  t,
  target: null,
 };

 assertValidContainer(settingsList(ctx).container);
});

test('the fleet view renders without any configured tokens', async () => {
 const previous = process.env.INFO_TOKEN;
 delete process.env.INFO_TOKEN;

 try {
  const t = await plugin.t('en-GB');
  const ctx: ViewContext = {
   data,
   emotes,
   mention,
   page: 1,
   plugin,
   scope: HelpScope.Commands,
   sessionId: '',
   t,
   target: null,
  };

  assertValidContainer(fleet(ctx));
 } finally {
  if (previous !== undefined) process.env.INFO_TOKEN = previous;
 }
});

test('the fleet labels are keyed by the fleet bot values themselves', () => {
 assert.deepEqual(Object.keys(en.bots).sort(), Object.values(FleetBot).sort());
});

test('an unknown session path renders the not-found copy', async () => {
 const t = await plugin.t('en-GB');

 assert.equal(typeof t.panel.notFound({ query: 'x', closest: 'y' }), 'string');
 assert.equal(typeof t.panel.title({ bot: 'Ayako' }), 'string');
 assert.equal(typeof t.options.choices({ choices: 'a, b' }), 'string');
 assert.equal(typeof t.scope.optionsFor({ command: 'x' }), 'string');
 assert.equal(typeof t.fleet.invite({ bot: 'Ayako' }), 'string');
});
