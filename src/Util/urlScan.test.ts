import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import { afterEach, test } from 'node:test';

import {
 extractUrls,
 fetchWithRedirects,
 getTldMatcher,
 isPrivateAddress,
 maxRedirects,
} from './urlScan.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
 globalThis.fetch = originalFetch;
});

test('extractUrls fails closed on an empty TLD set', () => {
 assert.deepEqual(extractUrls('visit example.com right now', new Set()), []);
});

test('extractUrls matches only domains ending in a known TLD', () => {
 const tlds = new Set(['com', 'gg']);
 const found = extractUrls(
  'visit https://discord.gg/abc and foo.com but never bar.zzz',
  tlds,
 );

 assert.ok(found.some((u) => u.includes('discord.gg/abc')));
 assert.ok(found.some((u) => u.includes('foo.com')));
 assert.ok(!found.some((u) => u.includes('bar.zzz')));
});

test('getTldMatcher compiles once per TLD set reference', () => {
 const setA = new Set(['com', 'net']);
 const setB = new Set(['org']);

 const first = getTldMatcher(setA);
 const second = getTldMatcher(setA);
 assert.equal(first, second);

 const third = getTldMatcher(setB);
 assert.notEqual(third, first);
});

test('isPrivateAddress refuses private and link-local ranges', () => {
 for (const ip of [
  '0.0.0.1',
  '10.0.0.1',
  '100.64.0.1',
  '100.127.255.255',
  '127.0.0.1',
  '169.254.10.20',
  '172.16.0.1',
  '172.31.255.255',
  '192.168.1.1',
  '224.0.0.1',
  '239.1.1.1',
  '255.255.255.255',
  '::1',
  'fc00::1',
  'fd12:3456::1',
  'fe80::1',
  'fc00::8.8.8.8',
  '::ffff:10.0.0.1',
  '0:0:0:0:0:ffff:10.0.0.1',
 ]) {
  assert.equal(isPrivateAddress(ip), true, `${ip} should be private`);
 }

 for (const ip of [
  '8.8.8.8',
  '1.1.1.1',
  '99.99.99.99',
  '100.63.255.255',
  '100.128.0.1',
  '172.15.0.1',
  '172.32.0.1',
  '223.255.255.255',
  '2606:2800::1',
  '::ffff:8.8.8.8',
 ]) {
  assert.equal(isPrivateAddress(ip), false, `${ip} should be public`);
 }
});

test('fetchWithRedirects caps the redirect chain', async () => {
 let calls = 0;
 globalThis.fetch = (async () => {
  const next = calls;
  calls += 1;
  return {
   status: 302,
   headers: { get: (h: string) => (h === 'location' ? `http://8.8.8.${next}/` : null) },
  } as unknown as Response;
 }) as typeof fetch;

 const chain = await fetchWithRedirects('http://8.8.8.200/');

 assert.equal(chain.length, maxRedirects);
 assert.equal(calls, maxRedirects);
});

test('fetchWithRedirects refuses a private host without hitting the network', async () => {
 let calls = 0;
 globalThis.fetch = (async () => {
  calls += 1;
  return { status: 200, headers: { get: () => null } } as unknown as Response;
 }) as typeof fetch;

 const chain = await fetchWithRedirects('http://127.0.0.1/admin');

 assert.deepEqual(chain, []);
 assert.equal(calls, 0);
});

test('fetchWithRedirects never throws on fetch failure', async () => {
 globalThis.fetch = (async () => {
  throw new Error('network down');
 }) as typeof fetch;

 const chain = await fetchWithRedirects('http://8.8.8.8/');
 assert.deepEqual(chain, []);
});

test('fetchWithRedirects resolves a relative Location against the base', async () => {
 const seen: string[] = [];
 globalThis.fetch = (async (input: string) => {
  seen.push(input);
  if (seen.length === 1) {
   return {
    status: 302,
    headers: { get: (h: string) => (h === 'location' ? '/next' : null) },
   } as unknown as Response;
  }
  return { status: 200, headers: { get: () => null } } as unknown as Response;
 }) as typeof fetch;

 const chain = await fetchWithRedirects('http://8.8.8.8/start');

 assert.equal(chain.length, 2);
 assert.equal(chain[1].url, 'http://8.8.8.8/next');
 assert.deepEqual(seen, ['http://8.8.8.8/start', 'http://8.8.8.8/next']);
});

test('fetchWithRedirects refuses an IPv6-literal private host without fetching', async () => {
 let calls = 0;
 globalThis.fetch = (async () => {
  calls += 1;
  return { status: 200, headers: { get: () => null } } as unknown as Response;
 }) as typeof fetch;

 const chain = await fetchWithRedirects('http://[::1]/admin');

 assert.deepEqual(chain, []);
 assert.equal(calls, 0);
});

test('fetchWithRedirects refuses the WHATWG-normalized IPv4-mapped IPv6 literal', async () => {
 let calls = 0;
 globalThis.fetch = (async () => {
  calls += 1;
  return { status: 200, headers: { get: () => null } } as unknown as Response;
 }) as typeof fetch;

 const chain = await fetchWithRedirects('http://[::ffff:10.0.0.1]/');

 assert.deepEqual(chain, []);
 assert.equal(calls, 0);
});

test('fetchWithRedirects refuses a host that DNS-resolves to a private address', async () => {
 let calls = 0;
 globalThis.fetch = (async () => {
  calls += 1;
  return { status: 200, headers: { get: () => null } } as unknown as Response;
 }) as typeof fetch;

 const restore = dns.lookup;
 (dns as { lookup: unknown }).lookup = async () => [{ address: '10.0.0.5', family: 4 }];

 try {
  const chain = await fetchWithRedirects('http://internal.corp.example/');
  assert.deepEqual(chain, []);
  assert.equal(calls, 0);
 } finally {
  (dns as { lookup: unknown }).lookup = restore;
 }
});
