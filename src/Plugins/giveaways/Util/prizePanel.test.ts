import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PanelOrigin } from '../Classes/Routes.js';
import type GiveawaysPlugin from '../Plugin.js';

import { buildPanel, readPanelPrizes } from './prizePanel.js';

const t = new Proxy(
 {},
 { get: () => new Proxy(() => 'text', { get: () => () => 'text' }) },
) as unknown as Parameters<typeof buildPanel>[0];

const emotes = new Proxy({}, { get: () => ({ id: '1', name: 'x' }) }) as unknown as Parameters<
 typeof buildPanel
>[1];

const plugin = {
 getRoute: (...parts: string[]) => parts.join('_'),
} as unknown as GiveawaysPlugin;

const state = (prizes: string[]) => ({
 templateId: '10',
 channelId: '20',
 origin: PanelOrigin.Command,
 name: 'Weekly',
 winners: 2,
 prizes,
});

type Node = { custom_id?: string; disabled?: boolean; components?: Node[] };

const startButton = (components: unknown[]): boolean | undefined => {
 for (const node of components as Node[]) {
  if (node.custom_id?.startsWith('giveaways/panelstart')) return !!node.disabled;

  const nested = node.components ? startButton(node.components) : undefined;
  if (nested !== undefined) return nested;
 }

 return undefined;
};

test('the prize list survives a round trip through the panel, markdown characters included', () => {
 const prizes = ['AAAA-*BB*-CC', 'DD_EE_FF', '`GG`'];
 const components = buildPanel.call(plugin, t, emotes, state(prizes));

 assert.deepEqual(readPanelPrizes(components), prizes);
});

test('an empty panel reads back as no prizes', () => {
 assert.deepEqual(readPanelPrizes(buildPanel.call(plugin, t, emotes, state([]))), []);
});

test('start stays disabled until there is a prize for every winner', () => {
 assert.equal(startButton(buildPanel.call(plugin, t, emotes, state(['one']))), true);
 assert.equal(startButton(buildPanel.call(plugin, t, emotes, state(['one', 'two']))), false);
});
