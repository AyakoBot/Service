import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { TicketSetting } from '@ayako/database';

import type Client from '../../../Classes/Client.js';

import getSharedTicketGuilds from './getSharedTicketGuilds.js';

const setting = (id: number, guild: string) =>
 ({ id, guild, denyUsers: [], denyRoles: [], botToken: null }) as unknown as TicketSetting;

test('only servers served by the receiving bot are offered, and no other server is fetched', async () => {
 const fetched: string[] = [];
 const client = {
  db: {
   client: {
    ticketSetting: { findMany: async () => [setting(1, 'own'), setting(2, 'other')] },
   },
  },
  cache: {
   members: {
    get: async (guildId: string) => {
     fetched.push(guildId);
     return { roles: [] };
    },
   },
  },
 } as unknown as Client;

 const candidates = await getSharedTicketGuilds.call(client, 'user', (row) => row.guild === 'own');

 assert.deepEqual(
  candidates.map((candidate) => candidate.guildId),
  ['own'],
 );
 assert.deepEqual(fetched, ['own']);
});
