import assert from 'node:assert/strict';
import { test } from 'node:test';

import type ComponentBuilderPlugin from '../Plugin.js';

import ButtonBindings from './ButtonBindings.js';

interface StubAction {
 route: string;
 choices?: boolean;
}

const system = (name: string, settingName: string, actions: StubAction[], live = true) => ({
 name,
 settingName,
 isEnabled: () => true,
 isLiveFor: () => live,
 getRoute: (route: string, ...args: string[]) => [route, ...args].join('_'),
 buttonActions: actions.map(({ route, choices }) => ({
  route,
  label: async () => route,
  ...(choices
   ? {
      choices: async () => [
       { label: 'A', value: 'a' },
       { label: 'Bad', value: 'b_c' },
      ],
     }
   : {}),
 })),
});

const bindings = (...systems: unknown[]) =>
 new ButtonBindings({ client: { plugins: systems } } as unknown as ComponentBuilderPlugin);

const economy = system('Economy', 'economy', [
 { route: 'economy/shopBuy', choices: true },
 { route: 'economy/balance' },
]);

test('claims matches registered routes and their choice arity', () => {
 const registry = bindings(economy);

 assert.equal(registry.claims('economy/shopBuy_r1'), true);
 assert.equal(registry.claims('economy/shopBuy'), false);
 assert.equal(registry.claims('economy/shopBuy_r1_x'), false);
 assert.equal(registry.claims('economy/balance'), true);
 assert.equal(registry.claims('economy/balance_x'), false);
 assert.equal(registry.claims('economy/curvePreview_r1'), false);
 assert.equal(registry.claims('c-button-1'), false);
});

test('systems lists only live plugins that offer actions', () => {
 const hidden = system('Hidden', 'hidden', [{ route: 'hidden/go' }], false);
 const bare = { ...system('Bare', 'bare', []), buttonActions: undefined };

 assert.deepEqual(
  bindings(economy, hidden, bare)
   .systems('g')
   .map((entry) => entry.settingName),
  ['economy'],
 );
});

test('customId, choices and systemName build splittable ids', async () => {
 const registry = bindings(economy);
 const bound = registry.action('economy/shopBuy');
 assert.ok(bound);

 assert.equal(registry.customId(bound, 'r1'), 'economy/shopBuy_r1');
 assert.deepEqual(
  (await registry.choices('g', bound)).map((option) => option.value),
  ['a'],
 );
 assert.equal(registry.systemName('economy/balance'), 'Economy');
 assert.equal(registry.systemName('c-x'), null);
});
