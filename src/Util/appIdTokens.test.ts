import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildAppIdTokenMap } from './appIdTokens.js';

const tokenFor = (appId: string) => `${Buffer.from(appId).toString('base64')}.abcdef.ghijkl`;

test('maps every bot token to its application id', () => {
 const map = buildAppIdTokenMap({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Token: `Bot ${tokenFor('650691698409734151')}`,
  TICKET_TOKEN: tokenFor('1459543361898676447'),
  WELCOME_TOKEN: tokenFor('1544065213983236226'),
  DATABASE_URL: 'postgres://nope',
  SOME_SECRET: 'not-a-token',
 } as NodeJS.ProcessEnv);

 assert.equal(map.get('1544065213983236226'), tokenFor('1544065213983236226'));
 assert.equal(map.get('1459543361898676447'), tokenFor('1459543361898676447'));
 assert.equal(map.size, 3);
});

test('accepts 17 to 19 digit application ids', () => {
 const map = buildAppIdTokenMap({
  A_TOKEN: tokenFor('12345678901234567'),
  B_TOKEN: tokenFor('123456789012345678'),
  C_TOKEN: tokenFor('1234567890123456789'),
  D_TOKEN: tokenFor('12345'),
 } as NodeJS.ProcessEnv);

 assert.equal(map.size, 3);
 assert.equal(map.has('12345678901234567'), true);
 assert.equal(map.has('12345'), false);
});

test('strips the Bot prefix and ignores unparsable values', () => {
 const map = buildAppIdTokenMap({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Token: `Bot ${tokenFor('999999999999999999')}`,
  BROKEN_TOKEN: 'not.base64.at-all',
 } as NodeJS.ProcessEnv);

 assert.equal(map.get('999999999999999999'), tokenFor('999999999999999999'));
 assert.equal(map.size, 1);
});
