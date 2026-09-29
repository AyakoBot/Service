import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ComponentType } from 'discord-api-types/v10';

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import base from '../../../Languages/en-GB.json' with { type: 'json' };
import createTranslator from '../../../Util/translator.js';
import en from '../Language/en-GB.json' with { type: 'json' };

import type { ConfessionsTranslator } from './container.js';
import { ConfessionLogKind, authorSubject, logContainer, type ConfessionLogEvent } from './logContainer.js';

const t = {
 ...createTranslator(en),
 base: createTranslator(base),
} as unknown as ConfessionsTranslator;
const emotes = { get: () => ({ name: 'icon', id: '1' }) } as unknown as EmoteSet;

const author = '111111111111111111';
const actor = '222222222222222222';

interface Node {
 type: number;
 content?: string;
 components?: Node[];
 accessory?: { url?: string };
 accent_color?: number;
}

const render = (event: ConfessionLogEvent, subject = authorSubject(t, event.author, null)): Node =>
 logContainer(t, event, emotes, subject) as unknown as Node;

const texts = (node: Node): string[] => [
 ...(node.content ? [node.content] : []),
 ...(node.components ?? []).flatMap(texts),
];

describe('confession log containers', () => {
 it('names the author in the heading subject in hidden mode', () => {
  const box = render({ kind: ConfessionLogKind.Posted, number: 4, author, actor: null });

  assert.ok(texts(box)[0]?.includes(`<@${author}>`));
 });

 it('shows Anonymous and leaks no author id in anonymous mode', () => {
  const box = render({
   kind: ConfessionLogKind.Rejected,
   number: 4,
   author: null,
   actor,
   content: 'text',
   reason: 'spam',
  });
  const ids = JSON.stringify(box).match(/\d{17,20}/g) ?? [];

  assert.ok(texts(box)[0]?.includes('Anonymous'));
  assert.deepEqual([...new Set(ids)], [actor]);
 });

 it('attaches the jump link as a link-button accessory on the heading', () => {
  const link = 'https://discord.com/channels/1/2/3';
  const header = render({ kind: ConfessionLogKind.Posted, number: 7, author, actor: null, link })
   .components?.[0];

  assert.equal(header?.type, ComponentType.Section);
  assert.equal(header?.accessory?.url, link);
 });

 it('credits the moderator and the reason in the footer', () => {
  const footer =
   texts(render({ kind: ConfessionLogKind.Rejected, number: 7, author, actor, reason: 'off topic' })).at(-1) ??
   '';

  assert.ok(footer.startsWith('-# '));
  assert.ok(footer.includes(`by <@${actor}>`));
  assert.ok(footer.includes('Reason: off topic'));
 });

 it('colours the accent by what happened', () => {
  assert.equal(render({ kind: ConfessionLogKind.Posted, number: 1, author, actor: null }).accent_color, 0x00ff00);
  assert.equal(render({ kind: ConfessionLogKind.Rejected, number: 1, author, actor }).accent_color, 0xff0000);
 });

 it('keeps a maximum-length confession inside the Components V2 text limit and says it was cut', () => {
  const lines = texts(
   render({
    kind: ConfessionLogKind.Posted,
    number: 1,
    author,
    actor,
    content: 'x'.repeat(4000),
    reason: 'r'.repeat(300),
   }),
  );

  assert.ok(lines.join('').length <= 4000, String(lines.join('').length));
  assert.ok(lines.some((line) => line.includes('Truncated')));
 });
});
