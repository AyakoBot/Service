import assert from 'node:assert';
import { test } from 'node:test';

import { RequestHandlerError } from '@ayako/api';

import { checkToken, TokenCheckResult } from './tokenCheck.js';

const apiWith = (member: unknown) =>
 ({ botId: 'B', guilds: { getMember: async () => member } }) as never;

const errWith = (fields: { status?: number; code?: number }) => {
 const e = new RequestHandlerError({ guildId: 'G' }, 'boom');
 e.setError(Object.assign(new Error('boom'), fields));
 return e;
};

test('OK when getMember resolves to a value', async () => {
 assert.strictEqual(await checkToken(apiWith({ user: { id: 'B' } }), 'G'), TokenCheckResult.OK);
});

test('NotInGuild on Discord code 10004', async () => {
 assert.strictEqual(
  await checkToken(apiWith(errWith({ status: 404, code: 10004 })), 'G'),
  TokenCheckResult.NotInGuild,
 );
});

test('Invalid on HTTP 401', async () => {
 assert.strictEqual(
  await checkToken(apiWith(errWith({ status: 401 })), 'G'),
  TokenCheckResult.Invalid,
 );
});

test('NoAccess on other failures (e.g. 500)', async () => {
 assert.strictEqual(
  await checkToken(apiWith(errWith({ status: 500 })), 'G'),
  TokenCheckResult.NoAccess,
 );
});
