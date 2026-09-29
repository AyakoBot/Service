import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ConfessionBan } from '@ayako/database';

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import base from '../../../Languages/en-GB.json' with { type: 'json' };
import createTranslator from '../../../Util/translator.js';
import en from '../Language/en-GB.json' with { type: 'json' };

import { banEntryText, banListPage } from './banList.js';
import type { ConfessionsTranslator } from './container.js';
import { contentLimit } from './gates.js';
import { reportCard } from './reportCard.js';

const t = {
 ...createTranslator(en),
 base: createTranslator(base),
} as unknown as ConfessionsTranslator;
const emotes = { get: () => ({ name: 'icon', id: '1' }) } as unknown as EmoteSet;
const route = (name: string, ...args: string[]) => [name, ...args].join('_');

const ban = (over: Partial<ConfessionBan> = {}): ConfessionBan => ({
 guild: 'g',
 identity: 'f'.repeat(64),
 by: '222222222222222222',
 reason: null,
 until: null,
 createdAt: new Date(1_800_000_000_000),
 confession: 'c1',
 number: 47,
 reply: false,
 content: 'my confession',
 ...over,
});

interface Node {
 content?: string;
 custom_id?: string;
 accessory?: Node;
 components?: Node[];
}

const textOf = (list: Node[]): number =>
 list.reduce(
  (total, node) => total + (node.content?.length ?? 0) + textOf(node.components ?? []),
  0,
 );

describe('confession ban list', () => {
 it('names the banned confession, the moderator and a permanent term', () => {
  const text = banEntryText(t, ban());

  assert.ok(text.includes('Confession #47'));
  assert.ok(text.includes('by <@222222222222222222>'));
  assert.ok(text.includes('Permanent'));
  assert.ok(text.includes('> my confession'));
 });

 it('labels replies and unposted confessions, and says when no text was kept', () => {
  assert.ok(banEntryText(t, ban({ reply: true })).includes('Reply to confession #47'));
  assert.ok(banEntryText(t, ban({ number: null })).includes('Unposted confession'));
  assert.ok(banEntryText(t, ban({ content: null })).includes("The text wasn't kept."));
 });

 it('shows the expiry for temporary bans', () => {
  assert.ok(banEntryText(t, ban({ until: new Date(1_900_000_000_000) })).includes('Until'));
 });

 it('puts an unban button on every entry and pages only when needed', () => {
  const one = banListPage(t, { bans: [ban()], page: 0, pages: 1, total: 1 }, route, emotes) as Node[];
  const many = banListPage(t, { bans: [ban()], page: 0, pages: 3, total: 11 }, route, emotes) as Node[];
  const section = one[0]?.components?.find((node) => node.accessory);

  assert.equal(section?.accessory?.custom_id, `confessions/bansunban_${'f'.repeat(64)}_0`);
  assert.equal(one.length, 1);
  assert.equal(many.length, 2);
 });

 it('says so when nobody is banned', () => {
  const empty = banListPage(t, { bans: [], page: 0, pages: 1, total: 0 }, route, emotes);

  assert.ok(JSON.stringify(empty).includes('No confession authors are banned.'));
 });

 it('keeps a full page of maximum-length bans within the text limit', () => {
  const full = Array.from({ length: 5 }, () =>
   ban({ content: 'x'.repeat(contentLimit), reason: 'r'.repeat(1000) }),
  );
  const page = banListPage(t, { bans: full, page: 0, pages: 1, total: 5 }, route, emotes) as Node[];

  assert.ok(textOf(page) <= 4000, String(textOf(page)));
 });
});

describe('confession report card', () => {
 const view = {
  subject: 'Confession #47',
  content: 'x'.repeat(contentLimit),
  media: 'https://example.com/a.png',
  reporter: '333333333333333333',
  reason: 'r'.repeat(1000),
  link: 'https://discord.com/channels/1/2/3',
 };

 it('stays within the text limit with the longest text and reason', () => {
  assert.ok(textOf([reportCard(t, view, emotes) as Node]) <= 4000);
 });

 it('names the reporter and never anyone else', () => {
  const ids = JSON.stringify(reportCard(t, view, emotes)).match(/\d{17,20}/g) ?? [];

  assert.deepEqual([...new Set(ids)], ['333333333333333333']);
 });
});
