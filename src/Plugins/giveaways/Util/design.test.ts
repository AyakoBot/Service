import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ComponentType, MessageFlags, type APITextDisplayComponent } from 'discord-api-types/v10';

import { designFits, normalizeDesign, savedDesign } from './design.js';

const text = (content: string): APITextDisplayComponent => ({
 type: ComponentType.TextDisplay,
 content,
});

test('normalizeDesign keeps content and every embed and drops webhook fields', () => {
 const design = normalizeDesign({
  content: 'Win {{prize}}',
  embeds: [{ title: 'One' }, { title: 'Two' }],
  username: 'Spoofed',
  avatar_url: 'https://example.com/a.png',
  attachments: [{ id: '1' }],
  thread_name: 'thread',
 });

 assert.deepEqual(design, {
  content: 'Win {{prize}}',
  embeds: [{ title: 'One' }, { title: 'Two' }],
 });
});

test('normalizeDesign keeps only the components of a Components V2 message', () => {
 const design = normalizeDesign({
  flags: MessageFlags.IsComponentsV2,
  content: 'ignored',
  components: [text('Hello')],
 });

 assert.deepEqual(design, { components: [text('Hello')] });
});

test('normalizeDesign caps embeds at ten and skips empty ones', () => {
 const embeds = Array.from({ length: 12 }, (_, i) => ({ title: String(i) }));
 const design = normalizeDesign({ embeds: [{}, ...embeds] });

 assert.equal(design?.embeds?.length, 10);
 assert.equal(design?.embeds?.[0].title, '0');
});

test('normalizeDesign rejects anything without content, embeds or components', () => {
 assert.equal(normalizeDesign(null), null);
 assert.equal(normalizeDesign('text'), null);
 assert.equal(normalizeDesign({ content: '   ', embeds: [{}] }), null);
 assert.equal(normalizeDesign({ flags: MessageFlags.IsComponentsV2, components: [] }), null);
});

test('savedDesign turns saved embeds and saved components into designs', () => {
 assert.deepEqual(savedDesign({ embed: { title: 'Saved' } }), { embeds: [{ title: 'Saved' }] });
 assert.deepEqual(savedDesign({ components: [text('Saved')] }), { components: [text('Saved')] });
 assert.equal(savedDesign(null), null);
});

test('designFits leaves room for the giveaway buttons', () => {
 assert.equal(designFits({ embeds: [{ title: 'x' }] }), true);
 assert.equal(designFits({ components: Array.from({ length: 37 }, () => text('x')) }), true);
 assert.equal(designFits({ components: Array.from({ length: 38 }, () => text('x')) }), false);
});
