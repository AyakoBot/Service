import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dbErrorText } from './dbErrorText.js';

const prismaForeignKey = [
 'Invalid `prisma.ticketSetting.deleteMany()` invocation:',
 '',
 '',
 'Foreign key constraint violated on the constraint: `Ticket_settingsId_fkey`',
].join('\n');

test('keeps the last meaningful line of a Prisma error', () => {
 assert.equal(
  dbErrorText(new Error(prismaForeignKey)),
  'Foreign key constraint violated on the constraint: `Ticket_settingsId_fkey`',
 );
});

test('returns null when there is nothing to show', () => {
 assert.equal(dbErrorText(new Error('')), null);
 assert.equal(dbErrorText(new Error('  \n \n')), null);
});

test('truncates a runaway message', () => {
 const detail = dbErrorText(new Error('x'.repeat(500)));

 assert.equal(detail?.length, 301);
 assert.ok(detail?.endsWith('…'));
});
