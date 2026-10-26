import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TicketState } from '@ayako/database';

import ChannelTicket from './ChannelTicket.js';

const creatorId = '9';
const staffId = '2';

const stubTicket = (state: TicketState, claimOnReply = true) => {
 const claims: string[] = [];
 const row = { id: '1', user: creatorId, state, claimer: null, settings: { claimOnReply } };
 const stub = {
  id: '1',
  dbTicket: row,
  getTicket: async () => row,
  canUserClaim: async () => true,
  claim: ({ userId }: { userId: string }) => ({
   next: async () => {
    claims.push(userId);
    await new Promise((resolve) => setTimeout(resolve, 10));
   },
  }),
  plugin: { nonFatalError: () => undefined },
 };

 return { stub, claims };
};

const claimOnReply = (stub: unknown, userId: string) =>
 ChannelTicket.prototype.claimOnReply.call(stub as unknown as ChannelTicket, userId);

describe('claimOnReply', () => {
 it('claims an open ticket for the replying staff member', async () => {
  const { stub, claims } = stubTicket(TicketState.opened);
  await claimOnReply(stub, staffId);
  assert.deepEqual(claims, [staffId]);
 });

 it('does nothing while the setting is off', async () => {
  const { stub, claims } = stubTicket(TicketState.opened, false);
  await claimOnReply(stub, staffId);
  assert.deepEqual(claims, []);
 });

 it('leaves an already claimed ticket alone', async () => {
  const { stub, claims } = stubTicket(TicketState.claimed);
  await claimOnReply(stub, staffId);
  assert.deepEqual(claims, []);
 });

 it('ignores replies from the ticket creator', async () => {
  const { stub, claims } = stubTicket(TicketState.opened);
  await claimOnReply(stub, creatorId);
  assert.deepEqual(claims, []);
 });

 it('claims once when several replies arrive together', async () => {
  const { stub, claims } = stubTicket(TicketState.opened);
  await Promise.all([claimOnReply(stub, staffId), claimOnReply(stub, staffId)]);
  assert.deepEqual(claims, [staffId]);
 });
});
