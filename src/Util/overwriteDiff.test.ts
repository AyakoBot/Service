import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OverwriteType, type APIOverwrite } from 'discord-api-types/v10';

import { canonicalOverwrites, diffOverwrites } from './overwriteDiff.js';

const overwrite = (id: string, allow: string, deny: string): APIOverwrite => ({
 id,
 type: OverwriteType.Role,
 allow,
 deny,
});

test('canonicalOverwrites is order-insensitive and null-safe', () => {
 assert.equal(
  canonicalOverwrites([overwrite('b', '1', '0'), overwrite('a', '0', '2')]),
  canonicalOverwrites([overwrite('a', '0', '2'), overwrite('b', '1', '0')]),
 );
 assert.equal(canonicalOverwrites(null), canonicalOverwrites([]));
});

test('diffOverwrites classifies added, removed and bit-changed overwrites', () => {
 const diff = diffOverwrites(
  [overwrite('kept', '1', '0'), overwrite('edited', '1', '0'), overwrite('gone', '4', '0')],
  [overwrite('kept', '1', '0'), overwrite('edited', '0', '1'), overwrite('new', '2', '0')],
 );

 assert.deepEqual(
  diff.added.map((entry) => entry.id),
  ['new'],
 );
 assert.deepEqual(
  diff.removed.map((entry) => entry.id),
  ['gone'],
 );
 assert.deepEqual(
  diff.changed.map((entry) => entry.overwrite.id),
  ['edited'],
 );
});

test('diffOverwrites treats a numeric-versus-string bitfield as unchanged', () => {
 const before = [{ ...overwrite('role', '1024', '0'), allow: 1024 as unknown as string }];
 const diff = diffOverwrites(before, [overwrite('role', '1024', '0')]);

 assert.equal(diff.changed.length, 0);
 assert.equal(diff.added.length, 0);
 assert.equal(diff.removed.length, 0);
});
