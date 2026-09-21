import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
 ApplicationCommandOptionType,
 ApplicationCommandType,
 type APIApplicationCommandAutocompleteInteraction,
} from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';
import HelpPlugin from '../Plugin.js';
import { autocomplete } from '../Events/InteractionCreate/command.js';

const baseAppId = '650691698409734151';

const client = {
 plugins: [],
 getBaseAPI: () => ({ botId: baseAppId }),
 getLocale: async () => 'en-GB',
} as unknown as Client;

const calls: unknown[][] = [];

const plugin = new HelpPlugin(client);

plugin.getInteractionAPI = async () =>
 ({
  botId: baseAppId,
  applications: { getCurrent: async () => ({ name: 'Ayako' }) },
  applicationCommands: {
   getGlobalCommands: async () => [],
   getGuildCommands: async () => [],
  },
  interactions: {
   createAutocompleteResponse: async (...args: unknown[]) => {
    calls.push(args);

    return undefined;
   },
  },
 }) as never;

const autocompleteInteraction = (name: string): APIApplicationCommandAutocompleteInteraction =>
 ({
  id: '1',
  application_id: baseAppId,
  token: 't',
  type: 4,
  guild_id: '9',
  data: {
   id: '2',
   name,
   type: ApplicationCommandType.ChatInput,
   options: [
    {
     name: 'command',
     type: ApplicationCommandOptionType.String,
     value: 'mo',
     focused: true,
    },
   ],
  },
 }) as unknown as APIApplicationCommandAutocompleteInteraction;

test('autocomplete for another plugin answers nothing at all', async () => {
 calls.length = 0;

 await autocomplete.call(plugin, autocompleteInteraction('settings'));

 assert.equal(calls.length, 0, 'help must not consume another command autocomplete');
});

test('autocomplete for tag stays unanswered', async () => {
 calls.length = 0;

 await autocomplete.call(plugin, autocompleteInteraction('tag'));

 assert.equal(calls.length, 0);
});

test('autocomplete for help answers with filtered choices', async () => {
 calls.length = 0;

 await autocomplete.call(plugin, autocompleteInteraction('help'));

 assert.equal(calls.length, 1);

 const [id, token, payload] = calls[0] as [string, string, { choices: unknown[] }];

 assert.equal(id, '1');
 assert.equal(token, 't');
 assert.ok(Array.isArray(payload.choices));
});
