import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { StickyRoleMode } from '@ayako/database';

import { filterStickyRoles } from './stickyRoleGrant.js';

describe('filterStickyRoles', () => {
 it('treats everything as sticky under the default exclude mode', () => {
  assert.deepEqual(filterStickyRoles(StickyRoleMode.exclude, [], ['a', 'b']), {
   staged: ['a', 'b'],
   skipped: [],
  });
 });

 it('drops configured roles under exclude mode', () => {
  assert.deepEqual(filterStickyRoles(StickyRoleMode.exclude, ['b'], ['a', 'b', 'c']), {
   staged: ['a', 'c'],
   skipped: ['b'],
  });
 });

 it('keeps only configured roles under include mode', () => {
  assert.deepEqual(filterStickyRoles(StickyRoleMode.include, ['b'], ['a', 'b', 'c']), {
   staged: ['b'],
   skipped: ['a', 'c'],
  });
 });

 it('stages nothing under include mode with no configured roles', () => {
  assert.deepEqual(filterStickyRoles(StickyRoleMode.include, [], ['a', 'b']), {
   staged: [],
   skipped: ['a', 'b'],
  });
 });

 it('collapses duplicate role ids so a bulk grant cannot stage one twice', () => {
  assert.deepEqual(filterStickyRoles(StickyRoleMode.exclude, ['c'], ['a', 'a', 'b', 'c', 'c']), {
   staged: ['a', 'b'],
   skipped: ['c'],
  });
 });
});
