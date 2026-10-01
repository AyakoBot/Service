import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ComponentType, type APIMessageTopLevelComponent } from 'discord-api-types/v10';

import { NodeAction, NodeKind } from '../Classes/Nodes.js';

import {
 addCost,
 AddPosition,
 addTargetArgs,
 affordableActions,
 defaultPosition,
 insertAtTarget,
 normalizeTarget,
 parseAddTarget,
 positionsFor,
 resolvePlacement,
 rootAddActions,
 type AddTarget,
} from './addTarget.js';
import {
 BuilderErrorCode,
 countComponents,
 getNode,
 kindOf,
 makeButton,
 makeContainer,
 makeRow,
 makeSectionWithButton,
 makeSectionWithThumbnail,
 makeStringSelect,
 makeText,
 type WipNode,
 type WipTree,
} from './componentTree.js';

const fullRow = (): APIMessageTopLevelComponent => ({
 type: ComponentType.ActionRow,
 components: [1, 2, 3, 4, 5].map((n) => makeButton(`c-full-${n}`, 'x')),
});

const fullSection = (): APIMessageTopLevelComponent => ({
 ...makeSectionWithButton('a', 'c-fs', 'F'),
 components: [makeText('a'), makeText('b'), makeText('c')],
});

const sample = (): WipTree => [
 makeText('intro'),
 makeContainer('inside'),
 makeSectionWithButton('section', 'c-s', 'Go'),
 makeRow(makeButton('c-a', 'A')),
 makeRow(makeStringSelect('c-sel', 'One')),
 fullRow(),
 fullSection(),
];

const containerActions = rootAddActions.filter((action) => action !== NodeAction.AddContainer);

const place = (position: AddPosition, selectedPath: string | null) =>
 resolvePlacement(sample(), { position, selectedPath });

test('inside targets append to containers, sections and button rows that have room', () => {
 assert.deepEqual(place(AddPosition.Inside, '1'), {
  anchor: '1',
  parentPath: '1',
  index: 1,
  actions: containerActions,
 });
 assert.deepEqual(place(AddPosition.Inside, '2'), {
  anchor: '2',
  parentPath: '2',
  index: 1,
  actions: [NodeAction.AddText],
 });
 assert.deepEqual(place(AddPosition.Inside, '3'), {
  anchor: '3',
  parentPath: '3',
  index: 1,
  actions: [NodeAction.AddButton],
 });
});

test('inside is unavailable for leaves, full parents and select rows', () => {
 assert.equal(place(AddPosition.Inside, '0'), null);
 assert.equal(place(AddPosition.Inside, '4'), null);
 assert.equal(place(AddPosition.Inside, '5'), null);
 assert.equal(place(AddPosition.Inside, '6'), null);
 assert.equal(place(AddPosition.Inside, null), null);
 assert.equal(place(AddPosition.Inside, '99'), null);
});

test('after targets insert next to the selection within its parent', () => {
 assert.deepEqual(place(AddPosition.After, '0'), {
  anchor: '0',
  parentPath: '',
  index: 1,
  actions: rootAddActions,
 });
 assert.deepEqual(place(AddPosition.After, '1.0'), {
  anchor: '1.0',
  parentPath: '1',
  index: 1,
  actions: containerActions,
 });
 assert.deepEqual(place(AddPosition.After, '3.0'), {
  anchor: '3.0',
  parentPath: '3',
  index: 1,
  actions: [NodeAction.AddButton],
 });
 assert.deepEqual(place(AddPosition.After, '2.0'), {
  anchor: '2.0',
  parentPath: '2',
  index: 1,
  actions: [NodeAction.AddText],
 });
});

test('after lifts to the parent when the parent row or section cannot take more', () => {
 assert.equal(place(AddPosition.After, '4.0')?.anchor, '4');
 assert.equal(place(AddPosition.After, '4.0')?.index, 5);
 assert.equal(place(AddPosition.After, '5.2')?.anchor, '5');
 assert.equal(place(AddPosition.After, '6.1')?.anchor, '6');
 assert.deepEqual(place(AddPosition.After, '6.1')?.actions, rootAddActions);
});

test('after an accessory means after its section', () => {
 assert.deepEqual(place(AddPosition.After, '2.a'), {
  anchor: '2',
  parentPath: '',
  index: 3,
  actions: rootAddActions,
 });
});

test('the end target always appends to the message root', () => {
 assert.deepEqual(place(AddPosition.End, null), {
  anchor: null,
  parentPath: '',
  index: 7,
  actions: rootAddActions,
 });
 assert.equal(place(AddPosition.After, null), null);
});

test('default position prefers inside, falls back to after, and ends without selection', () => {
 const tree = sample();
 assert.equal(defaultPosition(tree, null), AddPosition.End);
 assert.equal(defaultPosition(tree, '99'), AddPosition.End);
 assert.equal(defaultPosition(tree, '1'), AddPosition.Inside);
 assert.equal(defaultPosition(tree, '2'), AddPosition.Inside);
 assert.equal(defaultPosition(tree, '3'), AddPosition.Inside);
 assert.equal(defaultPosition(tree, '0'), AddPosition.After);
 assert.equal(defaultPosition(tree, '5'), AddPosition.After);
 assert.equal(defaultPosition(tree, '6'), AddPosition.After);
 assert.equal(defaultPosition(tree, '3.0'), AddPosition.After);
});

test('position buttons offer inside only for containers, sections and rows', () => {
 const tree = sample();
 assert.deepEqual(positionsFor(tree, null), [AddPosition.End]);
 assert.deepEqual(positionsFor(tree, '0'), [AddPosition.After, AddPosition.End]);
 assert.deepEqual(positionsFor(tree, '1'), [
  AddPosition.Inside,
  AddPosition.After,
  AddPosition.End,
 ]);
 assert.deepEqual(positionsFor(tree, '5'), [
  AddPosition.Inside,
  AddPosition.After,
  AddPosition.End,
 ]);
});

test('normalizeTarget drops stale paths and replaces unusable positions', () => {
 const tree = sample();
 assert.deepEqual(normalizeTarget(tree, { position: AddPosition.Inside, selectedPath: '0' }), {
  position: AddPosition.After,
  selectedPath: '0',
 });
 assert.deepEqual(normalizeTarget(tree, { position: AddPosition.After, selectedPath: '99' }), {
  position: AddPosition.End,
  selectedPath: null,
 });
 assert.deepEqual(normalizeTarget(tree, { position: AddPosition.Inside, selectedPath: '1' }), {
  position: AddPosition.Inside,
  selectedPath: '1',
 });
});

test('targets survive the custom id round trip without underscores', () => {
 const target = { position: AddPosition.After, selectedPath: '1.0' };
 assert.deepEqual(parseAddTarget(addTargetArgs(target)), target);

 const end = { position: AddPosition.End, selectedPath: null };
 assert.deepEqual(parseAddTarget(addTargetArgs(end)), end);

 assert.deepEqual(parseAddTarget(['garbage', '']), end);
 assert.deepEqual(parseAddTarget([]), end);
 assert.ok(Object.values(AddPosition).every((position) => !position.includes('_')));
});

test('insertAtTarget places the node and reports its path', () => {
 const inside = insertAtTarget(
  sample(),
  { position: AddPosition.Inside, selectedPath: '1' },
  NodeAction.AddText,
  makeText('new'),
 );
 assert.ok(inside.ok);
 assert.equal(inside.path, '1.1');
 assert.equal((getNode(inside.tree, '1.1') as { content: string }).content, 'new');

 const after = insertAtTarget(
  sample(),
  { position: AddPosition.After, selectedPath: '0' },
  NodeAction.AddText,
  makeText('new'),
 );
 assert.ok(after.ok);
 assert.equal(after.path, '1');
 assert.equal(after.tree[2].type, ComponentType.Container);

 const intoRow = insertAtTarget(
  sample(),
  { position: AddPosition.After, selectedPath: '3.0' },
  NodeAction.AddButton,
  makeButton('c-b', 'B'),
 );
 assert.ok(intoRow.ok);
 assert.equal(intoRow.path, '3.1');
 assert.equal(kindOf(getNode(intoRow.tree, '3.1')!), NodeKind.Button);
});

test('interactive components outside a row get wrapped and the child is selected', () => {
 const atEnd = insertAtTarget(
  sample(),
  { position: AddPosition.End, selectedPath: null },
  NodeAction.AddButton,
  makeButton('c-b', 'B'),
 );
 assert.ok(atEnd.ok);
 assert.equal(atEnd.path, '7.0');
 assert.equal(atEnd.tree[7].type, ComponentType.ActionRow);

 const inContainer = insertAtTarget(
  sample(),
  { position: AddPosition.Inside, selectedPath: '1' },
  NodeAction.AddStringSelect,
  makeStringSelect('c-new', 'One'),
 );
 assert.ok(inContainer.ok);
 assert.equal(inContainer.path, '1.1.0');
 assert.equal(kindOf(getNode(inContainer.tree, '1.1.0')!), NodeKind.StringSelect);
});

test('add costs match how much each insert really grows the message', () => {
 const end: AddTarget = { position: AddPosition.End, selectedPath: null };
 const cases: [AddTarget, NodeAction, WipNode, number][] = [
  [end, NodeAction.AddText, makeText('x'), 1],
  [end, NodeAction.AddContainer, makeContainer('x'), 2],
  [end, NodeAction.AddSectionButton, makeSectionWithButton('x', 'c-x', 'X'), 3],
  [end, NodeAction.AddSectionThumbnail, makeSectionWithThumbnail('x', 'https://a.com/a.png'), 3],
  [end, NodeAction.AddButton, makeButton('c-x', 'X'), 2],
  [
   { position: AddPosition.Inside, selectedPath: '1' },
   NodeAction.AddStringSelect,
   makeStringSelect('c-x', 'X'),
   2,
  ],
  [
   { position: AddPosition.Inside, selectedPath: '3' },
   NodeAction.AddButton,
   makeButton('c-x', 'X'),
   1,
  ],
 ];

 for (const [target, action, node, cost] of cases) {
  const tree = sample();
  const placement = resolvePlacement(tree, target);
  const result = insertAtTarget(tree, target, action, node);
  assert.ok(placement, action);
  assert.ok(result.ok, action);
  assert.equal(countComponents(result.tree) - countComponents(tree), cost, action);
  assert.equal(addCost(tree, placement.parentPath, action), cost, action);
 }
});

const withRow = (texts: number): WipTree => [
 ...Array.from({ length: texts }, () => makeText('x')),
 makeRow(makeButton('c-a', 'A')),
];

const affordable = (tree: WipTree, target: AddTarget): NodeAction[] => {
 const placement = resolvePlacement(tree, target);
 return placement ? affordableActions(tree, placement) : [];
};

test('the add list drops kinds that would overflow the 40 component limit', () => {
 const end: AddTarget = { position: AddPosition.End, selectedPath: null };
 const sections = [NodeAction.AddSectionButton, NodeAction.AddSectionThumbnail];

 const at38 = withRow(36);
 assert.equal(countComponents(at38), 38);
 assert.deepEqual(
  affordable(at38, end),
  rootAddActions.filter((action) => !sections.includes(action)),
 );

 const at39 = withRow(37);
 assert.deepEqual(affordable(at39, end), [
  NodeAction.AddText,
  NodeAction.AddSeparator,
  NodeAction.AddGallery,
 ]);
 assert.deepEqual(affordable(at39, { position: AddPosition.Inside, selectedPath: '37' }), [
  NodeAction.AddButton,
 ]);

 assert.deepEqual(affordable(withRow(38), end), []);
 assert.deepEqual(affordable(sample(), end), rootAddActions);
});

test('insertAtTarget rejects kinds the target cannot hold', () => {
 assert.deepEqual(
  insertAtTarget(
   sample(),
   { position: AddPosition.Inside, selectedPath: '1' },
   NodeAction.AddContainer,
   makeContainer('x'),
  ),
  { ok: false, error: BuilderErrorCode.NotAllowedHere },
 );
 assert.deepEqual(
  insertAtTarget(
   sample(),
   { position: AddPosition.Inside, selectedPath: '2' },
   NodeAction.AddButton,
   makeButton('c-b', 'B'),
  ),
  { ok: false, error: BuilderErrorCode.NotAllowedHere },
 );
});
