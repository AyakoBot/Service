import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PageDirection, ToolkitMode } from '../Classes/Enums.js';
import { TicketRoute } from '../Classes/Routes.js';

import { pageArgs, queryLimit, readPageArgs, readView, viewArgs } from './tagView.js';

const routed = (route: TicketRoute, args: { toString(): string }[]) => {
 const [, ...parts] = [route, ...args].join('_').split('_');
 return parts;
};

describe('tag toolkit view args', () => {
 it('keeps the mode and the search when paging', () => {
  const view = { page: 0, manage: true, query: 'refund' };
  const args = routed(TicketRoute.TagPage, pageArgs(PageDirection.Next, view));
  assert.deepEqual(readPageArgs(args), { ...view, page: 1 });
 });

 it('keeps underscores in the search', () => {
  const view = { page: 2, manage: false, query: 'a_b_c' };
  const args = routed(TicketRoute.TagPage, pageArgs(PageDirection.Prev, view));
  assert.deepEqual(readPageArgs(args), { ...view, page: 1 });
 });

 it('round-trips an empty search', () => {
  const view = { page: 3, manage: false, query: '' };
  assert.deepEqual(readView(routed(TicketRoute.TagPage, viewArgs(view))), view);
 });

 it('caps the search so the longest custom id fits', () => {
  const view = { page: 999, manage: true, query: 'x'.repeat(100) };
  const id = [TicketRoute.TagEditModal, '9'.repeat(20), ...viewArgs(view)].join('_');
  assert.equal(readView(viewArgs(view).map(String)).query.length, queryLimit);
  assert.ok(id.length <= 100, `custom id is ${id.length} characters`);
 });

 it('reads buttons posted before the view was encoded', () => {
  assert.deepEqual(readPageArgs([PageDirection.Next, '0']), { page: 1, manage: false, query: '' });
  assert.deepEqual(readPageArgs([PageDirection.Next, '0', ToolkitMode.Manage]), {
   page: 1,
   manage: true,
   query: '',
  });
 });
});
