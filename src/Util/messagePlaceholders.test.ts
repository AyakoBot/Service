import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
 basePlaceholders,
 MessagePlaceholder,
 placeholderDoc,
 renderPlaceholderList,
} from './messagePlaceholders.js';

test('placeholderDoc appends the plugin extras after the shared base set', () => {
 const base = placeholderDoc();

 assert.equal(base, renderPlaceholderList(basePlaceholders));
 assert.equal(base.includes('{{gif}}'), false);
 assert.equal(placeholderDoc(MessagePlaceholder.Gif), `${base} \`{{gif}}\``);
});

test('the shared base set covers both the member and the server placeholders', () => {
 assert.equal(basePlaceholders.includes(MessagePlaceholder.User), true);
 assert.equal(basePlaceholders.includes(MessagePlaceholder.Membercount), true);
 assert.equal(basePlaceholders.includes(MessagePlaceholder.Gif), false);
 assert.equal(basePlaceholders.includes(MessagePlaceholder.Days), false);
});
