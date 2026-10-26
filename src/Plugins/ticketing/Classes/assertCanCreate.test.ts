import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import ChannelTicket from './ChannelTicket.js';
import DmToChannelTicket from './DmToChannelTicket.js';
import { BaseTicketErrors, DMTicketErrors } from './Enums.js';

const userId = '9';
const staffId = '2';
const createOpts = { userId, roleIds: [] };

const stubTicket = (opts: { active?: boolean; denied?: boolean; hasDmTicket?: boolean } = {}) => {
 const calls: string[] = [];
 const stub = {
  plugin: { getPluginAPI: () => ({ botId: '1' }) },
  enforceCreateLimits: async () => {
   calls.push('limits');
  },
  getTicketSettings: async () => ({
   active: opts.active ?? true,
   denyUsers: opts.denied ? [userId] : [],
   denyRoles: [],
   botToken: null,
  }),
  hasDmTicket: async () => opts.hasDmTicket ?? false,
 };

 return { stub, calls };
};

const dbOpts = (opener?: string) => ({ settingsId: '1', userId, opener });

const channelCheck = (stub: unknown, opener?: string) =>
 ChannelTicket.prototype.assertCanCreate.call(stub as ChannelTicket, dbOpts(opener), createOpts);

const dmCheck = (stub: unknown, opener?: string) =>
 DmToChannelTicket.prototype.assertCanCreate.call(
  stub as DmToChannelTicket,
  dbOpts(opener),
  createOpts,
 );

describe('assertCanCreate', () => {
 it('rejects a denied member opening their own ticket', async () => {
  const { stub } = stubTicket({ denied: true });
  await assert.rejects(channelCheck(stub), new Error(BaseTicketErrors.create_UserDenied));
 });

 it('skips the deny lists but still checks limits when staff open the ticket', async () => {
  const { stub, calls } = stubTicket({ denied: true });
  await channelCheck(stub, staffId);
  assert.deepEqual(calls, ['limits']);
 });

 it('rejects an inactive system even when staff open the ticket', async () => {
  const { stub } = stubTicket({ active: false });
  await assert.rejects(
   channelCheck(stub, staffId),
   new Error(BaseTicketErrors.create_SettingsInactive),
  );
 });

 it('rejects a second DM ticket even when staff open it', async () => {
  const { stub } = stubTicket({ hasDmTicket: true });
  await assert.rejects(
   dmCheck(stub, staffId),
   new Error(DMTicketErrors.create_UserAlreadyInDmTicket),
  );
 });
});
