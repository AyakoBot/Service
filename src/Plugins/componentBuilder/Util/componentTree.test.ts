import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ButtonStyle, ComponentType } from 'discord-api-types/v10';

import {
 BuilderErrorCode,
 collectCustomIds,
 countComponents,
 flattenTree,
 getNode,
 insertNode,
 kindOf,
 makeButton,
 makeContainer,
 makeRow,
 makeSectionWithButton,
 makeSeparator,
 makeStringSelect,
 makeText,
 moveNode,
 nextCustomId,
 normalizeImport,
 removeNode,
 stripIds,
 validateTree,
 type WipTree,
} from './componentTree.js';

const sampleTree = (): WipTree => [
 makeText('hello'),
 makeContainer('inside'),
 makeRow(makeButton('c-button-1', 'Click')),
];

test('getNode resolves paths including nesting and accessories', () => {
 const tree: WipTree = [makeSectionWithButton('text', 'c-button-1', 'Go')];

 assert.equal(getNode(tree, '0')?.type, ComponentType.Section);
 assert.equal(getNode(tree, '0.0')?.type, ComponentType.TextDisplay);
 assert.equal(getNode(tree, '0.a')?.type, ComponentType.Button);
 assert.equal(getNode(tree, '1'), null);
 assert.equal(getNode(tree, '0.5'), null);
 assert.equal(getNode(tree, 'x'), null);
});

test('countComponents counts nested components and accessories', () => {
 assert.equal(countComponents(sampleTree()), 5);
 assert.equal(countComponents([makeSectionWithButton('t', 'c-b', 'l')]), 3);
});

test('flattenTree yields depth-annotated paths', () => {
 const flat = flattenTree(sampleTree());
 assert.deepEqual(
  flat.map((entry) => entry.path),
  ['0', '1', '1.0', '2', '2.0'],
 );
 assert.deepEqual(
  flat.map((entry) => entry.depth),
  [0, 0, 1, 0, 1],
 );
});

test('insertNode respects parent rules and caps', () => {
 const intoContainer = insertNode(sampleTree(), '1', makeSeparator());
 assert.ok(intoContainer.ok);
 assert.equal(kindOf(getNode(intoContainer.tree, '1.1')!), 'separator');

 const buttonIntoText = insertNode(sampleTree(), '0', makeButton('c-x', 'x'));
 assert.deepEqual(buttonIntoText, { ok: false, error: BuilderErrorCode.NotAllowedHere });

 const full = sampleTree();
 const row = getNode(full, '2');
 assert.ok(row?.type === ComponentType.ActionRow);
 for (let i = 2; i <= 5; i += 1) row.components.push(makeButton(`c-button-${i}`, 'x'));
 const sixth = insertNode(full, '2', makeButton('c-button-6', 'x'));
 assert.deepEqual(sixth, { ok: false, error: BuilderErrorCode.RowFull });
});

test('removeNode cascades empty rows and protects section texts', () => {
 const tree = sampleTree();
 const removed = removeNode(tree, '2.0');
 assert.ok(removed.ok);
 assert.equal(removed.tree.length, 2);

 const section: WipTree = [makeSectionWithButton('only', 'c-b', 'l')];
 assert.deepEqual(removeNode(section, '0.0'), {
  ok: false,
  error: BuilderErrorCode.SectionNeedsText,
 });
 assert.deepEqual(removeNode(section, '0.a'), {
  ok: false,
  error: BuilderErrorCode.NotAllowedHere,
 });
});

test('moveNode swaps siblings and clamps at edges', () => {
 const moved = moveNode(sampleTree(), '0', 1);
 assert.ok(moved.ok);
 assert.equal(moved.tree[0].type, ComponentType.Container);
 assert.equal(moved.tree[1].type, ComponentType.TextDisplay);

 const clamped = moveNode(sampleTree(), '0', -1);
 assert.ok(clamped.ok);
 assert.equal(clamped.tree[0].type, ComponentType.TextDisplay);
});

test('collectCustomIds and nextCustomId cover nested interactive components', () => {
 const tree: WipTree = [
  makeSectionWithButton('t', 'c-button-1', 'l'),
  makeRow(makeStringSelect('c-select-1', 'Option')),
 ];
 assert.deepEqual(collectCustomIds(tree), ['c-button-1', 'c-select-1']);
 assert.equal(nextCustomId(tree, 'button'), 'c-button-2');
 assert.equal(nextCustomId(tree, 'select'), 'c-select-2');
});

test('validateTree enforces the c- prefix and uniqueness', () => {
 const badPrefix: WipTree = [makeRow(makeButton('nope', 'x'))];
 assert.equal(validateTree(badPrefix), BuilderErrorCode.CustomIdPrefix);

 const duplicate: WipTree = [
  makeRow(makeButton('c-a', 'x')),
  makeRow(makeButton('c-a', 'y')),
 ];
 assert.equal(validateTree(duplicate), BuilderErrorCode.CustomIdTaken);

 assert.equal(validateTree(sampleTree()), null);
});

test('validateTree rejects unsupported and malformed components', () => {
 const file: WipTree = [
  { type: ComponentType.File, file: { url: 'attachment://a.png' } } as never,
 ];
 assert.equal(validateTree(file), BuilderErrorCode.UnsupportedComponent);

 const badLink: WipTree = [
  makeRow({ type: ComponentType.Button, style: ButtonStyle.Link, url: 'ftp://x', label: 'x' }),
 ];
 assert.equal(validateTree(badLink), BuilderErrorCode.InvalidUrl);

 const emptyText: WipTree = [makeText('')];
 assert.equal(validateTree(emptyText), BuilderErrorCode.EmptyContent);
});

test('stripIds removes ids recursively without touching content', () => {
 const tree = sampleTree();
 tree[0].id = 5;
 const container = getNode(tree, '1');
 assert.ok(container?.type === ComponentType.Container);
 container.components[0].id = 7;

 const stripped = stripIds(tree);
 assert.equal(stripped[0].id, undefined);
 assert.equal(getNode(stripped, '1.0')?.id, undefined);
 assert.equal((getNode(stripped, '0') as { content: string }).content, 'hello');
});

test('validateTree enforces the aggregate text budget', () => {
 const over: WipTree = [makeText('a'.repeat(2000)), makeText('b'.repeat(1600))];
 assert.equal(validateTree(over), BuilderErrorCode.TooMuchText);

 const under: WipTree = [makeText('a'.repeat(2000)), makeText('b'.repeat(1400))];
 assert.equal(validateTree(under), null);

 const single: WipTree = [makeText('a'.repeat(3600))];
 assert.equal(validateTree(single), BuilderErrorCode.TooMuchText);
});

test('validateTree rejects rows with non-interactive or mixed children', () => {
 const textRow: WipTree = [
  { type: ComponentType.ActionRow, components: [makeText('hi')] } as never,
 ];
 assert.equal(validateTree(textRow), BuilderErrorCode.RowFull);

 const mixed: WipTree = [
  {
   type: ComponentType.ActionRow,
   components: [makeButton('c-a', 'x'), makeStringSelect('c-s', 'One')],
  } as never,
 ];
 assert.equal(validateTree(mixed), BuilderErrorCode.RowFull);

 const selectRow: WipTree = [makeRow(makeStringSelect('c-s', 'One'))];
 assert.equal(validateTree(selectRow), null);
});

test('validateTree survives structurally malformed imports without throwing', () => {
 const cases: unknown[] = [
  [{ type: ComponentType.ActionRow }],
  [{ type: ComponentType.Button, style: ButtonStyle.Primary }],
  [{ type: ComponentType.StringSelect, custom_id: 'c-s' }],
  [{ type: ComponentType.MediaGallery }],
  [{ type: ComponentType.Section, components: [makeText('t')] }],
  [{ type: ComponentType.Thumbnail }],
  [{ type: ComponentType.Container }],
  [null],
  ['nonsense'],
 ];
 for (const tree of cases) {
  assert.notEqual(validateTree(tree as WipTree), null);
 }
});

test('validateTree rejects style/field mismatches and over-limit values on buttons', () => {
 const linkWithId: WipTree = [
  makeRow({
   type: ComponentType.Button,
   style: ButtonStyle.Link,
   url: 'https://a.com/',
   custom_id: 'c-x',
   label: 'x',
  } as never),
 ];
 assert.equal(validateTree(linkWithId), BuilderErrorCode.NotAllowedHere);

 const longLabel: WipTree = [makeRow(makeButton('c-a', 'x'.repeat(81)))];
 assert.equal(validateTree(longLabel), BuilderErrorCode.TooLong);

 const badMax: WipTree = [
  makeRow({ ...makeStringSelect('c-s', 'One'), max_values: 26 } as never),
 ];
 assert.equal(validateTree(badMax), BuilderErrorCode.InvalidNumber);
});

test('insertNode and updateNode enforce the text budget at mutation time', () => {
 const nearFull: WipTree = [makeText('a'.repeat(3400))];
 const insert = insertNode(nearFull, '', makeText('b'.repeat(200)));
 assert.deepEqual(insert, { ok: false, error: BuilderErrorCode.TooMuchText });
});

test('normalizeImport accepts arrays, messages, and single components', () => {
 assert.deepEqual(normalizeImport([makeText('a')]), [makeText('a')]);
 assert.deepEqual(normalizeImport({ components: [makeText('a')] }), [makeText('a')]);
 assert.deepEqual(normalizeImport(makeText('a')), [makeText('a')]);
 assert.equal(normalizeImport('nope'), null);
 assert.equal(normalizeImport({ foo: 1 }), null);
});
