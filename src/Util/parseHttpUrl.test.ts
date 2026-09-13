import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import parseHttpUrl from './parseHttpUrl.js';

describe('parseHttpUrl', () => {
 it('accepts http and https and normalises', () => {
  assert.equal(parseHttpUrl('https://cdn.discordapp.com/a.png'), 'https://cdn.discordapp.com/a.png');
  assert.equal(parseHttpUrl('  http://example.com  '), 'http://example.com/');
 });

 it('refuses every other scheme', () => {
  assert.equal(parseHttpUrl('javascript:alert(1)'), null);
  assert.equal(parseHttpUrl('data:image/png;base64,AAAA'), null);
  assert.equal(parseHttpUrl('file:///etc/passwd'), null);
  assert.equal(parseHttpUrl('attachment://a.png'), null);
 });

 it('refuses unparseable input', () => {
  assert.equal(parseHttpUrl(''), null);
  assert.equal(parseHttpUrl('not a url'), null);
  assert.equal(parseHttpUrl('cdn.discordapp.com/a.png'), null);
 });
});
