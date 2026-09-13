import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RequestHandlerError, type RequestHandlerErrorType } from '@ayako/api';
import { DiscordAPIError } from '@discordjs/rest';
import { RESTJSONErrorCodes } from 'discord-api-types/v10';

import { isErrorCode, type Sentinel } from './sentinel.js';

const sentinelWith = (error: Error | null): Sentinel => {
 const sentinel = new RequestHandlerError<RequestHandlerErrorType.Guilds>(
  { guildId: '1' },
  'failed',
 );
 if (error) sentinel.setError(error);
 return sentinel;
};

const discordError = (code: number, status: number) =>
 new DiscordAPIError({ code, message: 'error' }, code, status, 'GET', 'https://discord.test', {
  body: undefined,
  files: undefined,
 });

describe('sentinel', () => {
 it('matches the exact Discord error code', () => {
  const sentinel = sentinelWith(discordError(RESTJSONErrorCodes.UnknownMember, 404));
  assert.equal(isErrorCode(sentinel, RESTJSONErrorCodes.UnknownMember), true);
 });

 it('rejects a different Discord error code', () => {
  const sentinel = sentinelWith(discordError(RESTJSONErrorCodes.MissingPermissions, 403));
  assert.equal(isErrorCode(sentinel, RESTJSONErrorCodes.UnknownMember), false);
 });

 it('rejects a non-Discord failure', () => {
  assert.equal(
   isErrorCode(sentinelWith(new Error('socket hang up')), RESTJSONErrorCodes.UnknownMember),
   false,
  );
 });

 it('rejects a sentinel without an underlying error', () => {
  assert.equal(isErrorCode(sentinelWith(null), RESTJSONErrorCodes.UnknownBan), false);
 });
});
