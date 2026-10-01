import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';

import { isLink, resolveBuilderLink } from './builderLinks.js';

const encode = (value: unknown): string =>
 Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

const exampleValue =
 '1$H4sIAAAAAAAACqWUz4rbMBDGXyXMWd3IlvxPUAqFFnrqob21SxhLo8RFtowlLxuWfY8eCn3FPkJRNtlsdhPaUnwynpnfN/PN+MsdxO1IoLKKAWpNQ1xp7/wEqsnzQmacQRh952gCZdEFYqB9P/qBhhhAfXnM5+nDEGmIoODdLfajo8UxVME9Ox/7dXg7x+iH8DTiAiVnEOLWEaiCgcOWHCjYpy/iBiMwoN5/60ANs3MMTBewdWQexc9TStnEOAa1XK69Xzu60r5/Aj9CsiNk6+eFxuGP9fUcou9XnQEFokRt0dRGZrWsJK+lQTKZ4YaXLdn8LDM/Ms2E6wVOfh7MP3HzLDc6w1oWppBNlmtjbS1lqU0rjMgzuL++bMYncqTjoqdh/htHxCm6aazGvJK24Sh5xVtqK16X1lghitZqYODH2CW3U41Dp58pxEXYkTufhnyDbiZQIKUuBCejrW1krQsqRVVKwYXMGsqLHBgYCnrqdkVBQaTwZAnuIKl6GNmAfar46+f3H3Cf0izOLoKK00wvBpoaP4j7GDc0nVWnuS255bW0WkpqGtINl1g3thbWoi2fq3sQcmrkQcbex+c6rhmMDjVtvDPpBgEY9N2w2kkIO196vH18FWcqXPb6fefoxGTBwHZpC+/2h4Ixot70NES1XAbSE8VXKeJqNDZN8fTfcJn0ocf1KSpn0EXqH/agJ9PhkXo4T7zBiFO4WndxM7dzoGlfM13scl5WVdGIshJvwussr4HBOPnb7eq/iuxW44Vnz/q8Ts9vb3B6wzwFAAA=';

const withFetch = async (
 reply: (url: string) => unknown,
 run: (calls: string[]) => Promise<void>,
): Promise<void> => {
 const original = globalThis.fetch;
 const calls: string[] = [];
 globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  calls.push(url);
  const body = reply(url);
  return new Response(JSON.stringify(body), { status: body === null ? 404 : 200 });
 }) as typeof fetch;

 try {
  await run(calls);
 } finally {
  globalThis.fetch = original;
 }
};

test('isLink matches http(s) urls only', () => {
 assert.equal(isLink('https://discohook.app/?data=x'), true);
 assert.equal(isLink('{"embeds":[]}'), false);
});

test('discohook data link resolves to the first message payload', async () => {
 const data = encode({ version: 'd2', messages: [{ data: { embeds: [{ title: 'hi' }] } }] });
 assert.deepEqual(await resolveBuilderLink(`https://discohook.app/?data=${data}`), {
  embeds: [{ title: 'hi' }],
 });
});

test('discohook data link with no messages resolves to null', async () => {
 assert.equal(
  await resolveBuilderLink('https://discohook.app/?data=eyJ2ZXJzaW9uIjoiZDIiLCJtZXNzYWdlcyI6W119'),
  null,
 );
});

test('discohook share link reads the share api', async () => {
 await withFetch(
  () => ({ data: { version: 'd2', messages: [{ data: { content: 'shared' } }] } }),
  async (calls) => {
   assert.deepEqual(await resolveBuilderLink('https://discohook.app/?share=MLI22Uw6'), {
    content: 'shared',
   });
   assert.deepEqual(calls, ['https://discohook.app/api/v1/share/MLI22Uw6']);
  },
 );
});

test('message.style share link reads the shared-messages api', async () => {
 const message = { flags: 32768, components: [{ type: 17, components: [] }] };

 await withFetch(
  () => ({ success: true, data: { id: 's82w0J9k', data: message } }),
  async (calls) => {
   assert.deepEqual(
    await resolveBuilderLink('https://message.style/app/editor/share/s82w0J9k'),
    message,
   );
   assert.deepEqual(calls, ['https://message.style/api/shared-messages/s82w0J9k']);
  },
 );
});

test('expired or missing shares resolve to null', async () => {
 await withFetch(
  () => null,
  async () => {
   assert.equal(await resolveBuilderLink('https://message.style/app/editor/share/gone'), null);
   assert.equal(await resolveBuilderLink('https://discohook.app/?share=gone'), null);
  },
 );
});

test('discord.builders links decode literal and percent-encoded payloads', async () => {
 const literal = await resolveBuilderLink(`https://discord.builders/embed?v1=${exampleValue}`);
 const encoded = await resolveBuilderLink(
  `https://discord.builders/embed?v1=${encodeURIComponent(exampleValue)}`,
 );

 assert.equal((literal as { flags: number }).flags, 32768);
 assert.equal((literal as { components: { type: number }[] }).components[0]?.type, 17);
 assert.deepEqual(encoded, literal);
});

test('discord.builders rejects oversized, unversioned and garbage payloads', async () => {
 const huge = gzipSync(JSON.stringify(['x'.repeat(2 * 1024 * 1024)])).toString('base64');
 const small = gzipSync(JSON.stringify([{ type: 10, content: 'hi' }])).toString('base64');

 assert.equal(await resolveBuilderLink(`https://discord.builders/?v1=1$${huge}`), null);
 assert.equal(await resolveBuilderLink(`https://discord.builders/?v1=2$${small}`), null);
 assert.equal(await resolveBuilderLink(`https://discord.builders/?v1=${small}`), null);
 assert.equal(await resolveBuilderLink('https://discord.builders/?v1=1$notgzip'), null);
});

test('foreign hosts, garbage data and non-urls resolve to null without fetching', async () => {
 await withFetch(
  () => ({}),
  async (calls) => {
   assert.equal(await resolveBuilderLink('https://evil.example/?data=e30'), null);
   assert.equal(await resolveBuilderLink('https://message.style/app/editor/new'), null);
   assert.equal(await resolveBuilderLink('https://discohook.app/?data=%%%'), null);
   assert.equal(await resolveBuilderLink('not a url'), null);
   assert.deepEqual(calls, []);
  },
 );
});
