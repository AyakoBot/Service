import assert from 'node:assert/strict';
import { test } from 'node:test';

import { matchPrefix, mentionPrefix } from './matchPrefix.js';

const id = '650691698409734151';

test('a mention prefix matches both mention forms and takes the space after it', () => {
 assert.equal(matchPrefix(`<@!${id}>`, `<@${id}> afk brb`), `<@${id}> `);
 assert.equal(matchPrefix(`<@${id}>`, `<@!${id}>afk`), `<@!${id}>`);
 assert.equal(matchPrefix(`<@${id}>`, `hi <@${id}> afk`), undefined);
});

test('a text prefix matches case-insensitively at the start only', () => {
 assert.equal(matchPrefix('A!', 'a!afk brb'), 'A!');
 assert.equal(matchPrefix(',', 'hello ,afk'), undefined);
});

test('only user mentions count as mention prefixes', () => {
 assert.ok(mentionPrefix.test(`<@!${id}>`));
 assert.ok(mentionPrefix.test(`<@${id}>`));
 assert.ok(!mentionPrefix.test(`<@&${id}>`));
 assert.ok(!mentionPrefix.test(`<#${id}>`));
});
