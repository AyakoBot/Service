import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ComponentType } from 'discord-api-types/v10';

import {
 applyButton,
 applySelect,
 applySelectOptions,
 applyText,
 parseGalleryLines,
 parseOptionLines,
} from './applyNode.js';
import {
 BuilderErrorCode,
 getNode,
 makeButton,
 makeRow,
 makeStringSelect,
 makeText,
 type WipTree,
} from './componentTree.js';

test('applyText trims, caps, and rejects empty content', () => {
 const tree: WipTree = [makeText('old')];
 const ok = applyText(tree, '0', '  new content  ');
 assert.ok(ok.ok);
 assert.equal((getNode(ok.tree, '0') as { content: string }).content, 'new content');

 assert.deepEqual(applyText(tree, '0', '   '), {
  ok: false,
  error: BuilderErrorCode.EmptyContent,
 });
});

test('applyButton enforces the c- prefix and uniqueness', () => {
 const tree: WipTree = [
  makeRow(makeButton('c-a', 'x')),
  makeRow(makeButton('c-b', 'y')),
 ];

 assert.deepEqual(applyButton(tree, '0.0', 'label', 'raw'), {
  ok: false,
  error: BuilderErrorCode.CustomIdPrefix,
 });
 assert.deepEqual(applyButton(tree, '0.0', 'label', 'c-b'), {
  ok: false,
  error: BuilderErrorCode.CustomIdTaken,
 });

 const keepOwn = applyButton(tree, '0.0', 'renamed', 'c-a');
 assert.ok(keepOwn.ok);
 assert.equal((getNode(keepOwn.tree, '0.0') as { label: string }).label, 'renamed');
});

test('applySelect validates numbers and bounds against options', () => {
 const tree: WipTree = [makeRow(makeStringSelect('c-s', 'One'))];

 const bad = applySelect(tree, '0.0', 'c-s', '', 'x', '2');
 assert.deepEqual(bad, { ok: false, error: BuilderErrorCode.InvalidNumber });

 const over = applySelect(tree, '0.0', 'c-s', '', '1', '2');
 assert.deepEqual(over, { ok: false, error: BuilderErrorCode.MinOverMax });

 const ok = applySelect(tree, '0.0', 'c-s', 'Pick…', '0', '1');
 assert.ok(ok.ok);
 const node = getNode(ok.tree, '0.0');
 assert.ok(node?.type === ComponentType.StringSelect);
 assert.equal(node.placeholder, 'Pick…');
 assert.equal(node.min_values, 0);
});

test('applySelectOptions parses lines and clamps min/max', () => {
 const tree: WipTree = [makeRow(makeStringSelect('c-s', 'One'))];
 const seeded = applySelect(tree, '0.0', 'c-s', '', '1', '1');
 assert.ok(seeded.ok);

 const ok = applySelectOptions(seeded.tree, '0.0', 'A | a | first\nB\nC | c');
 assert.ok(ok.ok);
 const node = getNode(ok.tree, '0.0');
 assert.ok(node?.type === ComponentType.StringSelect);
 assert.deepEqual(
  node.options.map((option) => option.value),
  ['a', 'B', 'c'],
 );
 assert.equal(node.options[0].description, 'first');
});

test('parseGalleryLines validates urls and caps items', () => {
 const items = parseGalleryLines('https://a.com/x.png | alt text\nhttps://b.com/y.png');
 assert.ok(Array.isArray(items));
 assert.deepEqual(items[0], { url: 'https://a.com/x.png', description: 'alt text' });
 assert.equal(items[1].description, undefined);

 assert.equal(parseGalleryLines('not-a-url'), BuilderErrorCode.InvalidUrl);
 assert.equal(
  parseGalleryLines(Array.from({ length: 11 }, () => 'https://a.com/x.png').join('\n')),
  BuilderErrorCode.GalleryItemCount,
 );
});

test('parseOptionLines rejects duplicate values', () => {
 assert.equal(parseOptionLines('A | same\nB | same'), BuilderErrorCode.CustomIdTaken);
});
