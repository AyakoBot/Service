import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EconomyBalance, EconomySetting } from '@ayako/database';

import type EconomyPlugin from '../Plugin.js';

import EconomyBank from './EconomyBank.js';

const stored = { guild: 'g', user: 'u', balance: 7 } as EconomyBalance;

const bankWith = (found: EconomyBalance | null) => {
 const calls: string[] = [];
 const economyBalance = {
  findUnique: async () => {
   calls.push('findUnique');
   return found;
  },
  createMany: async (args: { skipDuplicates?: boolean }) => {
   calls.push(`createMany skipDuplicates=${args.skipDuplicates}`);
   return { count: 1 };
  },
  findUniqueOrThrow: async () => {
   calls.push('findUniqueOrThrow');
   return stored;
  },
 };

 const plugin = { client: { db: { client: { economyBalance } } } } as unknown as EconomyPlugin;
 const bank = new EconomyBank(plugin);
 bank.settings = async () => ({ startBalance: 5 }) as EconomySetting;

 return { bank, calls };
};

describe('EconomyBank.row', () => {
 it('returns an existing balance with a single read', async () => {
  const { bank, calls } = bankWith(stored);

  assert.equal(await bank.row('g', 'u'), stored);
  assert.deepEqual(calls, ['findUnique']);
 });

 it('creates a missing balance with ON CONFLICT DO NOTHING, then reads it back', async () => {
  const { bank, calls } = bankWith(null);

  assert.equal(await bank.row('g', 'u'), stored);
  assert.deepEqual(calls, ['findUnique', 'createMany skipDuplicates=true', 'findUniqueOrThrow']);
 });
});
