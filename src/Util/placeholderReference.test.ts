import assert from 'node:assert/strict';
import { test } from 'node:test';

import type Client from '../Classes/Client.js';
import type { BaseLang } from '../Classes/abstracts/Plugin.js';

import { MessagePlaceholder, renderPlaceholderList } from './messagePlaceholders.js';
import { placeholderGroups, renderPlaceholderReference } from './placeholderReference.js';

const t = {
 title: () => 'Title',
 intro: () => 'Intro',
 none: () => 'None',
} as unknown as BaseLang['placeholders'];

const welcome = { name: 'Welcome', placeholders: [MessagePlaceholder.User, MessagePlaceholder.Server] };
const confessions = { name: 'Confessions', placeholders: [MessagePlaceholder.ServerId] };

const client = {
 getBaseAPI: () => ({ botId: 'main' }),
 plugins: [
  { name: 'Welcome', placeholders: welcome.placeholders, getAPI: async () => ({ botId: 'main' }) },
  { name: 'Confessions', placeholders: confessions.placeholders, getAPI: async () => ({ botId: 'cb' }) },
  { name: 'Help', placeholders: [], getAPI: async () => ({ botId: 'main' }) },
 ],
} as unknown as Client;

test('renders each group under the title and intro', () => {
 assert.equal(
  renderPlaceholderReference(t, [welcome, confessions]),
  `### Title\n-# Intro\n\n**Welcome**\n${renderPlaceholderList(welcome.placeholders)}` +
   `\n\n**Confessions**\n${renderPlaceholderList(confessions.placeholders)}`,
 );
});

test('falls back to the none line when nothing is offered', () => {
 assert.equal(renderPlaceholderReference(t, []), '### Title\n-# Intro\n\nNone');
});

test('the main bot lists every plugin that offers placeholders', async () => {
 assert.deepEqual(
  (await placeholderGroups.call(client, 'main', 'G1')).map((group) => group.name),
  ['Welcome', 'Confessions'],
 );
});

test('a plugin bot lists only its own plugin', async () => {
 assert.deepEqual(
  (await placeholderGroups.call(client, 'cb', 'G1')).map((group) => group.name),
  ['Confessions'],
 );
});

test('an unknown bot falls back to every plugin', async () => {
 assert.deepEqual(
  (await placeholderGroups.call(client, 'someone', 'G1')).map((group) => group.name),
  ['Welcome', 'Confessions'],
 );
});
