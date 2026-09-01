import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { RoleIconError, resolveRoleIconSource } from './roleIconSource.js';

const realFetch = globalThis.fetch;

const stubFetch = (body: string, contentType: string) => {
 let calls = 0;

 globalThis.fetch = (async () => {
  calls += 1;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  return new Response(body, { status: 200, headers: { 'content-type': contentType } });
 }) as typeof fetch;

 return () => calls;
};

const refuseFetch = () => {
 let calls = 0;

 globalThis.fetch = (async () => {
  calls += 1;
  throw new Error('fetch must not be called');
 }) as typeof fetch;

 return () => calls;
};

afterEach(() => {
 globalThis.fetch = realFetch;
});

describe('resolveRoleIconSource', () => {
 it('passes a unicode emoji through without fetching', async () => {
  const calls = refuseFetch();
  const res = await resolveRoleIconSource({ emoji: '  🎉  ' });

  assert.deepEqual(res, { unicodeEmoji: '🎉' });
  assert.equal(calls(), 0);
 });

 it('returns exactly one of unicodeEmoji and icon', async () => {
  const unicode = await resolveRoleIconSource({ emoji: '🎉' });
  assert.deepEqual(Object.keys(unicode), ['unicodeEmoji']);

  stubFetch('abc', 'image/png');
  const icon = await resolveRoleIconSource({
   url: 'https://cdn.discordapp.com/emojis/1.png',
  });
  assert.deepEqual(Object.keys(icon), ['icon']);
 });

 it('accepts a same-interaction attachment url', async () => {
  stubFetch('abc', 'image/png');
  const res = await resolveRoleIconSource({
   attachmentUrl: 'https://cdn.discordapp.com/attachments/1/2/icon.png',
  });

  assert.deepEqual(res, { icon: 'data:image/png;base64,YWJj' });
 });

 it('accepts cdn.discordapp.com and media.discordapp.net links', async () => {
  stubFetch('abc', 'image/png');
  const cdn = await resolveRoleIconSource({ url: 'https://cdn.discordapp.com/x/y.png' });
  assert.deepEqual(cdn, { icon: 'data:image/png;base64,YWJj' });

  stubFetch('abc', 'image/gif');
  const media = await resolveRoleIconSource({ url: 'https://media.discordapp.net/x/y.gif' });
  assert.deepEqual(media, { icon: 'data:image/gif;base64,YWJj' });
 });

 it('builds the cdn url for a custom guild emoji', async () => {
  const seen: string[] = [];
  globalThis.fetch = (async (url: string) => {
   seen.push(String(url));
   // eslint-disable-next-line @typescript-eslint/naming-convention
   return new Response('abc', { status: 200, headers: { 'content-type': 'image/gif' } });
  }) as typeof fetch;

  const res = await resolveRoleIconSource({ emoji: '<a:party:123456789012345678>' });

  assert.deepEqual(res, { icon: 'data:image/gif;base64,YWJj' });
  assert.deepEqual(seen, ['https://cdn.discordapp.com/emojis/123456789012345678.gif?size=4096']);
 });

 it('refuses a cdn.discordapp.com suffix impostor without fetching', async () => {
  const calls = refuseFetch();
  const res = await resolveRoleIconSource({
   url: 'https://cdn.discordapp.com.evil.com/x.png',
  });

  assert.deepEqual(res, { error: RoleIconError.NotDiscordCdn });
  assert.equal(calls(), 0);
 });

 it('refuses non-cdn and file urls without fetching', async () => {
  const calls = refuseFetch();

  assert.deepEqual(await resolveRoleIconSource({ url: 'https://example.com/x.png' }), {
   error: RoleIconError.NotDiscordCdn,
  });
  assert.deepEqual(await resolveRoleIconSource({ url: 'file:///etc/passwd' }), {
   error: RoleIconError.NotDiscordCdn,
  });
  assert.deepEqual(await resolveRoleIconSource({ attachmentUrl: 'https://evil.com/x.png' }), {
   error: RoleIconError.NotDiscordCdn,
  });
  assert.equal(calls(), 0);
 });

 it('refuses an unparseable emoji rather than falling through to the url', async () => {
  const calls = refuseFetch();
  const res = await resolveRoleIconSource({
   emoji: 'not-an-emoji',
   url: 'https://cdn.discordapp.com/x/y.png',
  });

  assert.deepEqual(res, { error: RoleIconError.NotDiscordCdn });
  assert.equal(calls(), 0);
 });

 it('reports a failed download as fetchFailed', async () => {
  globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch;

  assert.deepEqual(await resolveRoleIconSource({ url: 'https://cdn.discordapp.com/x/y.png' }), {
   error: RoleIconError.FetchFailed,
  });
 });

 it('reports no input', async () => {
  const calls = refuseFetch();

  assert.deepEqual(await resolveRoleIconSource({}), { error: RoleIconError.NoInput });
  assert.deepEqual(await resolveRoleIconSource({ emoji: '', url: '' }), {
   error: RoleIconError.NoInput,
  });
  assert.equal(calls(), 0);
 });
});
