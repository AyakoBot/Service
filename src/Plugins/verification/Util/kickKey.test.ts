import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kickKey, parseKickKey } from './kickKey.js';

describe('kickKey', () => {
 it('round-trips guild and user ids', () => {
  assert.deepEqual(parseKickKey(kickKey('123', '456')), { guildId: '123', userId: '456' });
 });

 it('rejects foreign prefixes', () => {
  assert.equal(parseKickKey('reminders:123:456'), null);
  assert.equal(parseKickKey('verification:captcha:123:456'), null);
 });

 it('rejects malformed keys', () => {
  assert.equal(parseKickKey('verification:kick:123'), null);
  assert.equal(parseKickKey('verification:kick:'), null);
 });
});
