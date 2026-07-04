import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { SettingsGuideSection } from '../SettingsSchema.js';

import {
 buildGuideBar,
 guideProgress,
 requiredColumnStepsLeft,
 sectionDeclined,
 sectionOpen,
 stepDone,
 stepRequired,
} from './buildGuidePage.js';
import { declineFlag } from './guideFlags.js';

const section = (over: Partial<SettingsGuideSection> = {}): SettingsGuideSection => ({
 id: 's',
 label: 'S',
 steps: [{ column: 'a', label: 'A', required: true }],
 ...over,
});

test('stepDone reads truthiness of the row value', () => {
 assert.equal(stepDone({ column: 'a', label: 'A' }, { a: 'x' }), true);
 assert.equal(stepDone({ column: 'a', label: 'A' }, { a: '' }), false);
 assert.equal(stepDone({ column: 'a', label: 'A' }, {}), false);
});

test('stepDone treats a boolean false as not done so it cannot defeat a gate', () => {
 assert.equal(stepDone({ column: 'a', label: 'A' }, { a: false }), false);
 assert.equal(stepDone({ column: 'a', label: 'A' }, { a: true }), true);
});

test('stepDone resolves action steps from the action state', () => {
 const step = { action: { customId: 'panelStep', doneIf: () => true }, label: 'A' };
 assert.equal(stepDone(step, {}, { panelStep: true }), true);
 assert.equal(stepDone(step, {}, { panelStep: false }), false);
 assert.equal(stepDone(step, {}), false);
});

test('stepRequired supports row-dependent requirement', () => {
 const step = {
  column: 'a',
  label: 'A',
  required: (row: Record<string, unknown>) => !row.b,
 };
 assert.equal(stepRequired(step, {}), true);
 assert.equal(stepRequired(step, { b: 'set' }), false);
 assert.equal(stepRequired({ column: 'a', label: 'A', required: true }, {}), true);
 assert.equal(stepRequired({ column: 'a', label: 'A' }, {}), false);
});

test('sectionOpen: a gated section with only a false boolean step stays gated', () => {
 const s = section({ gate: { flag: 1, question: 'Q' }, steps: [{ column: 'b', label: 'B' }] });
 assert.equal(sectionOpen(s, { b: false }, 0), false);
 assert.equal(sectionOpen(s, { b: true }, 0), true);
});

test('sectionOpen: ungated is always open', () => {
 assert.equal(sectionOpen(section(), {}, 0), true);
});

test('sectionOpen: gated opens when the flag bit is set', () => {
 const s = section({ gate: { flag: 1, question: 'Q' } });
 assert.equal(sectionOpen(s, {}, 0), false);
 assert.equal(sectionOpen(s, {}, 1), true);
});

test('sectionOpen: gated opens when any step already has a value', () => {
 const s = section({ gate: { flag: 1, question: 'Q' } });
 assert.equal(sectionOpen(s, { a: 'set' }, 0), true);
});

test('sectionDeclined reflects the shifted decline bit', () => {
 const s = section({ gate: { flag: 1, question: 'Q' } });
 assert.equal(sectionDeclined(s, 0), false);
 assert.equal(sectionDeclined(s, declineFlag(1)), true);
 assert.equal(sectionDeclined(section(), declineFlag(1)), false);
});

test('guideProgress counts required visible steps in open sections', () => {
 const s = section();
 assert.deepEqual(guideProgress([s], { a: 'x' }, 0), { done: 1, total: 1 });
 assert.deepEqual(guideProgress([s], {}, 0), { done: 0, total: 1 });
});

test('guideProgress skips declined sections entirely', () => {
 const gated = section({ id: 'g', gate: { flag: 1, question: 'Q' } });
 assert.deepEqual(guideProgress([gated], { a: 'x' }, declineFlag(1)), { done: 0, total: 0 });
});

test('guideProgress counts required action steps via the action state', () => {
 const s = section({
  steps: [{ action: { customId: 'panelStep', doneIf: () => true }, label: 'A', required: true }],
 });
 assert.deepEqual(guideProgress([s], {}, 0, { panelStep: true }), { done: 1, total: 1 });
 assert.deepEqual(guideProgress([s], {}, 0), { done: 0, total: 1 });
});

test('requiredColumnStepsLeft ignores action steps and the excluded column', () => {
 const s = section({
  steps: [
   { column: 'a', label: 'A', required: true },
   { column: 'active', label: 'On', required: true },
   { action: { customId: 'panelStep', doneIf: () => false }, label: 'P', required: true },
  ],
 });
 assert.equal(requiredColumnStepsLeft([s], {}, 0, {}, 'active'), 1);
 assert.equal(requiredColumnStepsLeft([s], { a: 'x' }, 0, {}, 'active'), 0);
 assert.equal(requiredColumnStepsLeft([s], {}, 0, {}), 2);
});

test('buildGuideBar renders one icon per section and points at the current one', () => {
 const sections = [
  section({ id: 'one', emote: { name: 'one', id: '1' } }),
  section({ id: 'two', emote: { name: 'two', id: '2' } }),
  section({ id: 'three', emote: { name: 'three', id: '3' } }),
 ];
 const bar = buildGuideBar(sections, 1);
 const [icons, pointer] = bar.split('\n');
 assert.equal(icons, '<:one:1><:two:2><:three:3>');
 assert.match(pointer, /^<:invis:\d+>🔼$/);
});

test('buildGuideBar collapses for a single section', () => {
 assert.equal(buildGuideBar([section()], 0), '');
});
