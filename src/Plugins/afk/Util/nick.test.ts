import assert from 'node:assert/strict';
import { test } from 'node:test';

import { afkSuffixOf, taggedNick, untaggedNick } from './nick.js';

test('only a trailing AFK tag counts as the suffix', () => {
 assert.equal(afkSuffixOf('User [AFK]'), ' [AFK]');
 assert.equal(afkSuffixOf('User AFK'), ' AFK');
 assert.equal(afkSuffixOf('AFKBEAR'), undefined);
 assert.equal(afkSuffixOf('AFK Andy'), undefined);
 assert.equal(afkSuffixOf('KAFKA'), undefined);
 assert.equal(afkSuffixOf(null), undefined);
});

test('the tag shrinks to fit 32 characters or is skipped', () => {
 assert.equal(taggedNick('User'), 'User [AFK]');
 assert.equal(taggedNick('x'.repeat(27)), `${'x'.repeat(27)} AFK`);
 assert.equal(taggedNick('x'.repeat(30)), undefined);
});

test('restoring drops the tag and writes null when there was no nickname', () => {
 assert.equal(untaggedNick('Kafka [AFK]', 'Kafka'), null);
 assert.equal(untaggedNick('Boss [AFK]', 'Kai'), 'Boss');
 assert.equal(untaggedNick('AFK Andy AFK', 'Andy'), 'AFK Andy');
});
