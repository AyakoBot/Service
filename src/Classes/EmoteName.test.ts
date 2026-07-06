import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { EmoteName } from './EmoteName.js';

const assetNames = readdirSync(path.join('assets', 'icons', 'pngs'))
 .filter((file) => file.endsWith('.png'))
 .map((file) => file.replace(/\.png$/, '').replaceAll('-', '_'))
 .sort();

test('every EmoteName member has a png asset', () => {
 const missing = Object.values(EmoteName).filter((name) => !assetNames.includes(name));
 assert.deepEqual(missing, []);
});

test('every png asset has an EmoteName member', () => {
 const members = new Set<string>(Object.values(EmoteName));
 assert.deepEqual(
  assetNames.filter((name) => !members.has(name)),
  [],
 );
});
