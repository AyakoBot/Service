import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DiscordAPIError } from '@discordjs/rest';
import { RESTJSONErrorCodes } from 'discord-api-types/v10';

import type { BaseLang } from '../Classes/abstracts/Plugin.js';

import type { Sentinel } from './sentinel.js';
import threadOpenError from './threadOpenError.js';

type Vars = { channel: string; bot: string; error?: string };

const t = {
 errors: {
  threadNoAccess: (v: Vars) => `access ${v.channel} ${v.bot}`,
  threadNoPermission: (v: Vars) => `permission ${v.channel} ${v.bot}`,
  noThreadCanBeCreated: () => 'wrong channel',
  threadFailed: (v: Vars) => `failed ${v.channel} ${v.bot} ${v.error}`,
  unknownError: () => 'unknown',
 },
} as unknown as BaseLang;

const discordError = (code: number, message: string) =>
 ({
  error: new DiscordAPIError({ code, message }, code, 403, 'POST', '/channels/1/threads', {}),
  errorMessage: message,
 }) as unknown as Sentinel;

const validatorError = (message: string | null) =>
 ({ error: new Error(), errorMessage: message }) as unknown as Sentinel;

const explain = (error: Sentinel) => threadOpenError(t, error, '10', '20');

test('missing access names the channel and the bot that needs access', () => {
 assert.equal(
  explain(discordError(RESTJSONErrorCodes.MissingAccess, 'Missing Access')),
  'access <#10> <@20>',
 );
});

test('missing permissions names the channel and the bot that needs them', () => {
 assert.equal(
  explain(discordError(RESTJSONErrorCodes.MissingPermissions, 'Missing Permissions')),
  'permission <#10> <@20>',
 );
});

test('an unsupported channel type reuses the existing channel hint', () => {
 assert.equal(
  explain(discordError(RESTJSONErrorCodes.CannotExecuteActionOnThisChannelType, 'Cannot')),
  'wrong channel',
 );
});

test('any other Discord error keeps its message and code', () => {
 assert.equal(
  explain(discordError(RESTJSONErrorCodes.InvalidFormBodyOrContentType, 'Invalid Form Body')),
  'failed <#10> <@20> Invalid Form Body (50035)',
 );
});

test('a pre-request permission check keeps its own message without a code', () => {
 assert.equal(
  explain(validatorError('Missing CreatePrivateThreads permission')),
  'failed <#10> <@20> Missing CreatePrivateThreads permission',
 );
 assert.equal(explain(validatorError(null)), 'failed <#10> <@20> unknown');
});
