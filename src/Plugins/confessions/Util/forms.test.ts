import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import base from '../../../Languages/en-GB.json' with { type: 'json' };
import createTranslator from '../../../Util/translator.js';
import { MenuAction } from '../Classes/Routes.js';
import en from '../Language/en-GB.json' with { type: 'json' };

import type { ConfessionsTranslator } from './container.js';
import { actionPicker } from './forms.js';

const t = {
 ...createTranslator(en),
 base: createTranslator(base),
} as unknown as ConfessionsTranslator;

const route = (name: string, ...args: string[]) => [name, ...args].join('_');

const values = (revealable: boolean): string[] =>
 actionPicker(t, route, 'c1', revealable)
  .toJSON()
  .components.flatMap((menu) => ('options' in menu ? menu.options.map((o) => o.value) : []));

describe('actionPicker', () => {
 it('offers reveal when the author can be revealed', () => {
  assert.deepEqual(values(true), [MenuAction.Ban, MenuAction.Report, MenuAction.Reveal]);
 });

 it('leaves reveal out otherwise', () => {
  assert.deepEqual(values(false), [MenuAction.Ban, MenuAction.Report]);
 });
});
