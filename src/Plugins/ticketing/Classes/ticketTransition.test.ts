import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TicketState } from '@ayako/database';

import type BaseTicket from './BaseTicket.js';
import ChannelTicket from './ChannelTicket.js';
import { BaseTicketErrors } from './Enums.js';

const recordNotFound = 'P2025';
const base = Object.getPrototypeOf(ChannelTicket.prototype) as BaseTicket;

const stubTicket = () => {
 const row = { id: '1', user: '9', state: TicketState.opened as TicketState, claimer: null };
 const stub = {
  id: '1',
  dbTicket: row,
  plugin: {
   logger: { logLocation: () => undefined },
   reminders: { armForState: async () => undefined },
  },
  isClosed: async () => row.state === TicketState.closed,
  isClaimed: async () => row.state === TicketState.claimed,
  isOpened: async () => row.state === TicketState.opened,
  getTicket: async () => row,
  canUserClaim: async () => true,
  handleBaseLog: () => undefined,
  transition: base.transition,
  db: {
   ticket: {
    update: async ({
     where,
     data,
    }: {
     where: { state: { in: TicketState[] } };
     data: Partial<typeof row>;
    }) => {
     if (!where.state.in.includes(row.state)) {
      throw Object.assign(new Error('No record was found for an update.'), {
       code: recordNotFound,
      });
     }
     Object.assign(row, data);
     return row;
    },
   },
  },
 };

 const claim = () => base.claim.call(stub as unknown as BaseTicket, { userId: '2' });
 return { row, claim };
};

describe('ticket state transitions', () => {
 it('claims an open ticket', async () => {
  const { row, claim } = stubTicket();
  const run = claim();
  await run.next();
  await run.next();
  assert.equal(row.state, TicketState.claimed);
 });

 it('keeps a ticket closed when a claim resumes after the close', async () => {
  const { row, claim } = stubTicket();
  const run = claim();
  await run.next();

  row.state = TicketState.closed;

  await assert.rejects(run.next(), { message: BaseTicketErrors.transition_StateChanged });
  assert.equal(row.state, TicketState.closed);
 });
});
