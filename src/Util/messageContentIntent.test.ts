import assert from 'node:assert/strict';
import { test } from 'node:test';

import { flagsHaveMessageContent } from './messageContentIntent.js';

test('detects both the full and limited message content flags', () => {
 assert.equal(flagsHaveMessageContent(1 << 18), true);
 assert.equal(flagsHaveMessageContent(1 << 19), true);
 assert.equal(flagsHaveMessageContent((1 << 18) | (1 << 23)), true);
});

test('rejects flag sets without message content', () => {
 assert.equal(flagsHaveMessageContent(8421376), false);
 assert.equal(flagsHaveMessageContent(0), false);
 assert.equal(flagsHaveMessageContent(null), false);
 assert.equal(flagsHaveMessageContent(undefined), false);
});

test('matches the live ticketing and welcome flag values', () => {
 assert.equal(flagsHaveMessageContent(11010048), true);
 assert.equal(flagsHaveMessageContent(8421376), false);
 assert.equal(flagsHaveMessageContent(10485760), false);
});
