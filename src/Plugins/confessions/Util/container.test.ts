import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ConfessionAnonymity } from '@ayako/database';
import { ComponentType, MessageFlags } from 'discord-api-types/v10';

import base from '../../../Languages/en-GB.json' with { type: 'json' };
import type { SavedContent } from '../../../Util/savedRef.js';
import createTranslator from '../../../Util/translator.js';
import en from '../Language/en-GB.json' with { type: 'json' };

import {
 buildPost,
 buildReply,
 buildReview,
 menuButton,
 replyButton,
 submitButton,
 type ConfessionsTranslator,
} from './container.js';
import { contentLimit } from './gates.js';

const t = {
 ...createTranslator(en),
 base: createTranslator(base),
} as unknown as ConfessionsTranslator;

const route = (name: string, ...args: string[]) => [name, ...args].join('_');
const menu = menuButton(route, 'c1', { name: '❔' });
const withSubmit = { menu, buttons: [submitButton(t, route)] };
const bare = { menu, buttons: [] };

const view = {
 number: 47,
 numbered: true,
 content: 'I ate the last cookie',
 media: null,
 anonymity: ConfessionAnonymity.Unmaskable,
};
const vars = { confession: view.content, number: '47', server: 'Guild' };

interface Node {
 type: number;
 content?: string;
 custom_id?: string;
 accent_color?: number;
 accessory?: Node;
 components?: Node[];
}

const nodes = (value: unknown): Node[] => value as Node[];

const customIds = (node: Node | undefined): string[] =>
 (node?.components ?? []).map((child) => child.custom_id ?? '');

describe('confession post layouts', () => {
 it('puts the menu button beside the heading and the submit button below the container', () => {
  const post = nodes(buildPost(t, view, null, vars, withSubmit).components);
  const [container, row] = post;

  assert.equal(container?.type, ComponentType.Container);
  assert.equal(container?.components?.[0]?.type, ComponentType.Section);
  assert.equal(container?.components?.[0]?.accessory?.custom_id, 'confessions/menu_c1');
  assert.deepEqual(customIds(row), ['confessions/submit']);
 });

 it('gives the default container a random accent', () => {
  const accent = nodes(buildPost(t, view, null, vars, bare).components)[0]?.accent_color ?? -1;

  assert.ok(Number.isInteger(accent) && accent >= 0 && accent <= 0xffffff);
 });

 it('leaves the bottom row out when no button is enabled', () => {
  assert.equal(buildPost(t, view, null, vars, bare).components.length, 1);
 });

 it('fills a saved component layout, puts the menu in the bottom row, and never fills member placeholders', () => {
  const saved = {
   components: [{ type: ComponentType.TextDisplay, content: '#{{number}}: {{confession}} by {{user}}' }],
  } as unknown as SavedContent;
  const post = buildPost(t, view, saved, vars, withSubmit);
  const [text, row] = nodes(post.components);

  assert.equal(post.flags, MessageFlags.IsComponentsV2);
  assert.ok(text?.content?.startsWith('#47: I ate the last cookie by'));
  assert.ok(!text?.content?.includes('<@'));
  assert.deepEqual(customIds(row), ['confessions/menu_c1', 'confessions/submit']);
 });

 it('fills a saved embed and sends it without the Components V2 flag', () => {
  const saved = { embed: { title: 'Confession #{{number}}', description: '{{confession}}' } };
  const post = buildPost(t, view, saved, vars, withSubmit);

  assert.equal(post.flags, 0);
  assert.equal(post.embeds[0]?.title, 'Confession #47');
  assert.equal(post.embeds[0]?.description, 'I ate the last cookie');
  assert.deepEqual(customIds(nodes(post.components)[0]), ['confessions/menu_c1', 'confessions/submit']);
 });

 it('attaches the image link to saved layouts', () => {
  const withMedia = { ...view, media: 'https://example.com/a.png' };
  const embedPost = buildPost(t, withMedia, { embed: { description: '{{confession}}' } }, vars, bare);
  const componentPost = buildPost(t, withMedia, { components: [] }, vars, bare);

  assert.equal(embedPost.embeds[0]?.image?.url, 'https://example.com/a.png');
  assert.equal(nodes(componentPost.components)[0]?.type, ComponentType.MediaGallery);
 });
});

const textOf = (list: Node[]): number =>
 list.reduce(
  (total, node) =>
   total +
   (node.content?.length ?? 0) +
   textOf(node.components ?? []) +
   (node.accessory ? textOf([node.accessory]) : 0),
  0,
 );

describe('confession text limit', () => {
 const longest = 'x'.repeat(contentLimit);

 it('keeps a maximum-length post within the 4000 character limit', () => {
  const post = buildPost(t, { ...view, number: 99999, content: longest }, null, vars, bare);

  assert.ok(textOf(nodes(post.components)) <= 4000, String(textOf(nodes(post.components))));
 });

 it('drops the screened preview when both copies would not fit', () => {
  const card = nodes(
   buildReview(
    t,
    { ...view, content: longest, confessionId: 'c', screened: 'y'.repeat(contentLimit) },
    route,
   ),
  );

  assert.ok(textOf(card) <= 4000, String(textOf(card)));
  assert.ok(!JSON.stringify(card).includes('yyy'));
 });

 it('keeps the screened preview when it fits', () => {
  const card = buildReview(t, { ...view, confessionId: 'c', screened: 'I ate the [...] cookie' }, route);

  assert.ok(JSON.stringify(card).includes('> I ate the [...] cookie'));
 });
});

describe('confession replies', () => {
 it('routes the reply button to the confession it belongs to', () => {
  const button = replyButton(t, route, 'c9').toJSON() as Node & { label?: string };

  assert.equal(button.custom_id, 'confessions/reply_c9');
  assert.equal(button.label, 'Reply');
 });

 it('puts the menu beside the reply heading and adds no bottom row', () => {
  const reply = nodes(buildReply(t, { ...view, number: null }, menu));

  assert.equal(reply.length, 1);
  assert.equal(reply[0]?.components?.[0]?.accessory?.custom_id, 'confessions/menu_c1');
 });

 it('titles a reply review card with the confession it answers', () => {
  const card = buildReview(t, { ...view, confessionId: 'r1', screened: null, parentNumber: 47 }, route);

  assert.ok(JSON.stringify(card).includes('Reply to confession #47 awaiting review'));
 });
});
