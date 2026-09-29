import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NodePageNav, nodePageSize, shownNodePage, stepNodePage } from './nodePaging.js';

const entries = (count: number) => Array.from({ length: count }, (_, index) => ({ path: String(index) }));

test('a page holds 23 components so two page options still fit in 25', () => {
 assert.equal(nodePageSize, 23);
});

test('shows the page that holds the selected component', () => {
 assert.equal(shownNodePage(entries(40), '30', 0), 1);
 assert.equal(shownNodePage(entries(40), '5', 1), 0);
});

test('without a selection it shows the requested page, clamped to the last one', () => {
 assert.equal(shownNodePage(entries(40), null, 1), 1);
 assert.equal(shownNodePage(entries(40), null, 7), 1);
 assert.equal(shownNodePage(entries(10), null, 3), 0);
 assert.equal(shownNodePage(entries(0), null, -2), 0);
});

test('page options step one page from the shown one', () => {
 assert.equal(stepNodePage(1, NodePageNav.Previous), 0);
 assert.equal(stepNodePage(0, NodePageNav.Next), 1);
});
