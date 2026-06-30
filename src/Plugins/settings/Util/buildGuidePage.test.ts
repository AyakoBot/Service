import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { SettingsGuideSection } from '../SettingsSchema.js';

import { guideProgress, sectionOpen, stepDone } from './buildGuidePage.js';

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

test('guideProgress counts required visible steps in open sections', () => {
 const s = section();
 assert.deepEqual(guideProgress([s], { a: 'x' }, 0), { done: 1, total: 1 });
 assert.deepEqual(guideProgress([s], {}, 0), { done: 0, total: 1 });
});
