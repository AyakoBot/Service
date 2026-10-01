import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
 ButtonStyle,
 ComponentType,
 SeparatorSpacingSize,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import base from '../../../Languages/en-GB.json' with { type: 'json' };
import { NodeAction, NodeKind } from '../Classes/Nodes.js';
import en from '../Language/en-GB.json' with { type: 'json' };

import {
 flattenTree,
 makeButton,
 makeContainer,
 makeEntitySelect,
 makeGallery,
 makeRow,
 makeSectionWithButton,
 makeSectionWithThumbnail,
 makeSeparator,
 makeStringSelect,
 makeText,
 type WipTree,
} from './componentTree.js';
import {
 actionRowsFor,
 isActionDisabled,
 isBindable,
 movedSelection,
 moveUnit,
 offersAction,
 styleOptions,
 toggleState,
} from './nodeActions.js';

const structure = [NodeAction.MoveUp, NodeAction.MoveDown, NodeAction.Remove];

const buttonRow = (): APIMessageTopLevelComponent => ({
 type: ComponentType.ActionRow,
 components: [makeButton('c-x', 'X'), makeButton('c-y', 'Y')],
});

const sample = (): WipTree => [
 makeText('intro'),
 makeContainer('inside'),
 makeSectionWithButton('section', 'c-s', 'Go'),
 makeRow(makeButton('c-a', 'A')),
 makeRow(makeStringSelect('c-sel', 'One')),
 makeSeparator(),
 buttonRow(),
];

test('with nothing selected only Add… is offered', () => {
 assert.deepEqual(actionRowsFor(sample(), null), [[NodeAction.Add]]);
 assert.deepEqual(actionRowsFor(sample(), '99'), [[NodeAction.Add]]);
});

test('each kind gets its own actions plus Add…, then the structure row', () => {
 const tree = sample();
 assert.deepEqual(actionRowsFor(tree, '0'), [[NodeAction.Edit, NodeAction.Add], structure]);
 assert.deepEqual(actionRowsFor(tree, '1'), [
  [NodeAction.Edit, NodeAction.ToggleSpoiler, NodeAction.Add],
  structure,
 ]);
 assert.deepEqual(actionRowsFor(tree, '2'), [
  [NodeAction.AccessoryButton, NodeAction.AccessoryThumbnail, NodeAction.Add],
  structure,
 ]);
 assert.deepEqual(actionRowsFor(tree, '3'), [[NodeAction.Add], structure]);
 assert.deepEqual(actionRowsFor(tree, '3.0'), [
  [NodeAction.Edit, NodeAction.Style, NodeAction.ToggleDisabled, NodeAction.Bind, NodeAction.Add],
  structure,
 ]);
 assert.deepEqual(actionRowsFor(tree, '4.0'), [
  [NodeAction.Edit, NodeAction.EditOptions, NodeAction.ToggleDisabled, NodeAction.Add],
  structure,
 ]);
 assert.deepEqual(actionRowsFor(tree, '5'), [
  [NodeAction.ToggleDivider, NodeAction.ToggleSpacing, NodeAction.Add],
  structure,
 ]);
});

test('accessories get no structure row', () => {
 assert.deepEqual(actionRowsFor(sample(), '2.a'), [
  [NodeAction.Edit, NodeAction.Style, NodeAction.ToggleDisabled, NodeAction.Bind, NodeAction.Add],
 ]);
 assert.deepEqual(actionRowsFor([makeSectionWithThumbnail('t', 'https://a.com/a.png')], '0.a'), [
  [NodeAction.Edit, NodeAction.ToggleSpoiler, NodeAction.Add],
 ]);
});

test('every component fits in at most two rows of at most five buttons', () => {
 const tree: WipTree = [
  ...sample(),
  makeGallery([{ url: 'https://a.com/a.png' }]),
  makeSectionWithThumbnail('t', 'https://a.com/a.png'),
  makeRow(makeEntitySelect(NodeKind.UserSelect, 'c-u')),
  makeRow(makeEntitySelect(NodeKind.RoleSelect, 'c-r')),
  makeRow(makeEntitySelect(NodeKind.ChannelSelect, 'c-c')),
  makeRow(makeEntitySelect(NodeKind.MentionableSelect, 'c-m')),
 ];

 for (const { path } of flattenTree(tree)) {
  const rows = actionRowsFor(tree, path);
  assert.ok(rows.length >= 1 && rows.length <= 2, path);
  for (const row of rows) assert.ok(row.length >= 1 && row.length <= 5, path);
  assert.ok(rows.flat().includes(NodeAction.Add), path);
 }
});

test('toggleState reads the current state and ignores non-toggles', () => {
 const separator = makeSeparator();
 assert.equal(toggleState(separator, NodeAction.ToggleDivider), true);
 assert.equal(toggleState(separator, NodeAction.ToggleSpacing), false);
 assert.equal(
  toggleState({ ...separator, spacing: SeparatorSpacingSize.Large }, NodeAction.ToggleSpacing),
  true,
 );
 assert.equal(toggleState({ ...separator, divider: false }, NodeAction.ToggleDivider), false);

 assert.equal(toggleState(makeContainer('x'), NodeAction.ToggleSpoiler), false);
 assert.equal(
  toggleState({ ...makeContainer('x'), spoiler: true }, NodeAction.ToggleSpoiler),
  true,
 );
 assert.equal(
  toggleState({ ...makeButton('c-a', 'A'), disabled: true }, NodeAction.ToggleDisabled),
  true,
 );
 assert.equal(toggleState(makeText('x'), NodeAction.Edit), null);
});

test('a lone component in a row moves together with its row', () => {
 const tree = sample();
 assert.equal(moveUnit(tree, '4.0'), '4');
 assert.equal(moveUnit(tree, '6.0'), '6.0');
 assert.equal(movedSelection(tree, '4.0', -1), '3.0');
 assert.equal(movedSelection(tree, '6.1', -1), '6.0');
 assert.equal(movedSelection(tree, '0', -1), '0');
});

test('move buttons disable at the edges and Add… disables when the message is full', () => {
 const tree = sample();
 assert.equal(isActionDisabled(tree, '0', NodeAction.MoveUp), true);
 assert.equal(isActionDisabled(tree, '0', NodeAction.MoveDown), false);
 assert.equal(isActionDisabled(tree, '6', NodeAction.MoveDown), true);
 assert.equal(isActionDisabled(tree, '6.0', NodeAction.MoveUp), true);
 assert.equal(isActionDisabled(tree, '4.0', NodeAction.MoveDown), false);
 assert.equal(isActionDisabled(tree, '0', NodeAction.Remove), false);

 assert.equal(isActionDisabled(tree, null, NodeAction.Add), false);
 const full = Array.from({ length: 40 }, () => makeText('x'));
 assert.equal(isActionDisabled(full, null, NodeAction.Add), true);
});

test('offersAction accepts only presses the controls could have shown for that node', () => {
 const tree = sample();
 assert.equal(offersAction(tree, null, NodeAction.Add), true);
 assert.equal(offersAction(tree, '0', NodeAction.Edit), true);
 assert.equal(offersAction(tree, '5', NodeAction.ToggleDivider), true);
 assert.equal(offersAction(tree, '2', NodeAction.AccessoryThumbnail), true);

 assert.equal(offersAction(tree, null, NodeAction.Edit), false);
 assert.equal(offersAction(tree, null, NodeAction.MoveUp), false);
 assert.equal(offersAction(tree, '99', NodeAction.Remove), false);
 assert.equal(offersAction(tree, '0', NodeAction.EditOptions), false);
 assert.equal(offersAction(tree, '0', NodeAction.AccessoryThumbnail), false);
 assert.equal(offersAction(tree, '4.0', NodeAction.ToggleDivider), false);
 assert.equal(offersAction(tree, '2.a', NodeAction.Remove), false);
});

test('style presses fit every non-SKU button, accessories included', () => {
 const tree: WipTree = [
  ...sample(),
  makeRow({ type: ComponentType.Button, style: ButtonStyle.Premium, sku_id: '1' }),
 ];
 for (const { action } of styleOptions) {
  assert.equal(offersAction(tree, '3.0', action), true, action);
  assert.equal(offersAction(tree, '2.a', action), true, action);
  assert.equal(offersAction(tree, '0', action), false, action);
  assert.equal(offersAction(tree, '4.0', action), false, action);
  assert.equal(offersAction(tree, '7.0', action), false, action);
 }
});

test('every action, style and kind has a label', () => {
 const actions = en.actions as Record<string, string>;
 const kinds = en.kinds as Record<string, string>;

 for (const action of Object.values(NodeAction)) assert.equal(typeof actions[action], 'string');
 for (const kind of Object.values(NodeKind)) assert.equal(typeof kinds[kind], 'string');
 assert.equal(styleOptions.length, 5);
 assert.equal(typeof base.t.Inside, 'string');
 assert.equal(typeof base.t.After, 'string');
});

test('Call a system… is offered on custom-ID buttons only', () => {
 const tree: WipTree = [
  ...sample(),
  makeRow({ type: ComponentType.Button, style: ButtonStyle.Link, url: 'https://a.com', label: 'L' }),
  makeRow({ type: ComponentType.Button, style: ButtonStyle.Premium, sku_id: '1' }),
 ];

 assert.equal(offersAction(tree, '3.0', NodeAction.Bind), true);
 assert.equal(offersAction(tree, '2.a', NodeAction.Bind), true);
 assert.equal(offersAction(tree, '7.0', NodeAction.Bind), false);
 assert.equal(offersAction(tree, '8.0', NodeAction.Bind), false);
 assert.equal(offersAction(tree, '4.0', NodeAction.Bind), false);
});

test('isBindable accepts custom-ID buttons and nothing else', () => {
 assert.equal(isBindable(makeButton('c-a', 'A')), true);
 assert.equal(isBindable(makeText('t')), false);
 assert.equal(isBindable(makeStringSelect('c-s', 'One')), false);
});
