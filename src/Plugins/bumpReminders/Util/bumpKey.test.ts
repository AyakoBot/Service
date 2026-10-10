import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bumpKey, parseBumpKey } from './bumpKey.js';

describe('bumpKey', () => {
 it('round-trips the settings row id and guild id', () => {
  assert.deepEqual(parseBumpKey(bumpKey('1788436995867', '123')), {
   settingsId: '1788436995867',
   guildId: '123',
  });
 });

 it('rejects foreign prefixes', () => {
  assert.equal(parseBumpKey('reminders:123:456'), null);
  assert.equal(parseBumpKey('verification:kick:123:456'), null);
 });

 it('rejects malformed keys', () => {
  assert.equal(parseBumpKey('bump:123:'), null);
  assert.equal(parseBumpKey('bump::456'), null);
  assert.equal(parseBumpKey('bump:'), null);
  assert.equal(parseBumpKey('bump:123:456:789'), null);
 });
});
