import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Snippets, TicketSetting } from '@ayako/database';

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import base from '../../../Languages/en-GB.json' with { type: 'json' };
import createTranslator from '../../../Util/translator.js';
import en from '../Language/en-GB.json' with { type: 'json' };
import type TicketPlugin from '../Plugin.js';

import { outcomeContainer, type SnippetOutcome } from './runSnippet.js';

const t = {
 ...createTranslator(en),
 base: createTranslator(base),
} as unknown as Awaited<ReturnType<TicketPlugin['t']>>;

const emotes = new Proxy({}, { get: () => ({ id: null, name: 'x' }) }) as unknown as EmoteSet;
const snippet = { name: 'contact', trigger: '?contact' } as unknown as Snippets;
const choices = [{ id: '1712345678901', name: 'Support' }] as unknown as TicketSetting[];

const hasSelect = (outcome: SnippetOutcome, pickId: string) =>
 JSON.stringify(outcomeContainer(t, emotes, snippet, outcome, pickId).toJSON()).includes(
  '"custom_id"',
 );

describe('outcomeContainer', () => {
 const pick: SnippetOutcome = {
  failure: null,
  warnings: [],
  opened: null,
  pick: { user: '123456789012345678', choices },
 };

 it('offers the system picker when a pick is pending', () => {
  assert.equal(hasSelect(pick, 'tickets/contactPick_1'), true);
 });

 it('never adds a picker without a pick id', () => {
  assert.equal(hasSelect(pick, ''), false);
 });

 it('shows no picker once a ticket opened', () => {
  const opened: SnippetOutcome = {
   failure: null,
   warnings: [],
   opened: { channel: '1', user: '2' },
   pick: null,
  };
  assert.equal(hasSelect(opened, 'tickets/contactPick_1'), false);
 });
});
