import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isLink, resolveDiscohookLink } from './discohookLink.js';

const encode = (value: unknown): string =>
 Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

test('isLink matches http(s) urls only', () => {
 assert.equal(isLink('https://discohook.app/?data=x'), true);
 assert.equal(isLink('{"embeds":[]}'), false);
});

test('data link resolves to the first message payload', async () => {
 const data = encode({ version: 'd2', messages: [{ data: { embeds: [{ title: 'hi' }] } }] });
 assert.deepEqual(await resolveDiscohookLink(`https://discohook.app/?data=${data}`), {
  embeds: [{ title: 'hi' }],
 });
});

test('data link with no messages resolves to null', async () => {
 assert.equal(
  await resolveDiscohookLink(
   'https://discohook.app/?data=eyJ2ZXJzaW9uIjoiZDIiLCJtZXNzYWdlcyI6W119',
  ),
  null,
 );
});

test('foreign hosts, garbage data, and non-urls resolve to null', async () => {
 assert.equal(await resolveDiscohookLink('https://evil.example/?data=e30'), null);
 assert.equal(await resolveDiscohookLink('https://discohook.app/?data=%%%'), null);
 assert.equal(await resolveDiscohookLink('not a url'), null);
});
