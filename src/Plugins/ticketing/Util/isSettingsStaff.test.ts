import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TicketSetting } from '@ayako/database';
import { PermissionFlagsBits } from 'discord-api-types/v10';

import type Client from '../../../Classes/Client.js';

import isSettingsStaff from './isSettingsStaff.js';

const guildId = '1';
const userId = '5';
const memberRole = '7';
const staffRole = '8';

const settings = {
 guild: guildId,
 staffUsers: [],
 staffRoles: [staffRole],
} as unknown as TicketSetting;

const clientWith = (permissions: bigint) =>
 ({
  cache: {
   members: { get: async () => ({ user_id: userId, roles: [memberRole] }) },
   guilds: { get: async () => ({ id: guildId, owner_id: '0' }) },
   roles: {
    getAll: async () => [
     { id: guildId, permissions: '0' },
     { id: memberRole, permissions: String(permissions) },
    ],
   },
  },
 }) as unknown as Client;

describe('isSettingsStaff', () => {
 it('accepts a member with a staff role', async () => {
  assert.equal(await isSettingsStaff.call(clientWith(0n), settings, userId, [staffRole]), true);
 });

 it('accepts a member who can manage the server', async () => {
  const client = clientWith(PermissionFlagsBits.ManageGuild);
  assert.equal(await isSettingsStaff.call(client, settings, userId, [memberRole]), true);
 });

 it('accepts an administrator', async () => {
  const client = clientWith(PermissionFlagsBits.Administrator);
  assert.equal(await isSettingsStaff.call(client, settings, userId, [memberRole]), true);
 });

 it('rejects a member without a staff role or server rights', async () => {
  const client = clientWith(PermissionFlagsBits.SendMessages);
  assert.equal(await isSettingsStaff.call(client, settings, userId, [memberRole]), false);
 });
});
