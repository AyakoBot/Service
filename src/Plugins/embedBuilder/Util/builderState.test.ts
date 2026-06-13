import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ComponentType } from 'discord-api-types/v10';

import { EmbedProperty } from '../Classes/Properties.js';
import { EmbedBuilderRoute } from '../Classes/Routes.js';

import {
 buildMarkerUrl,
 getSelectedField,
 getSelectedProperty,
 getWipEmbed,
 isSendable,
 parseMarker,
 placeholderUrl,
 type BuilderMessageLike,
} from './builderState.js';

const selectRow = (route: string, options: { value: string; selected?: boolean }[]) => ({
 type: ComponentType.ActionRow as const,
 components: [
  {
   type: ComponentType.StringSelect as const,
   custom_id: route,
   options: options.map((o) => ({ label: o.value, value: o.value, default: o.selected })),
  },
 ],
});

test('round-trips the builder marker with webhook identity', () => {
 const url = buildMarkerUrl({ execId: '123', webhookName: 'Ann', webhookAvatar: 'https://a/b' });
 const parsed = parseMarker({ embeds: [{ url }] });
 assert.deepEqual(parsed, { execId: '123', webhookName: 'Ann', webhookAvatar: 'https://a/b' });
});

test('rejects messages without the builder marker', () => {
 assert.equal(parseMarker({ embeds: [{ url: 'https://ayakobot.com/?exec=1' }] }), null);
 assert.equal(parseMarker({ embeds: [{ url: 'not a url' }] }), null);
 assert.equal(parseMarker({ embeds: [] }), null);
});

test('treats the placeholder embed as empty state', () => {
 const msg: BuilderMessageLike = {
  embeds: [{ url: buildMarkerUrl({ execId: '1' }) }, { description: 'hint', url: placeholderUrl() }],
 };
 assert.deepEqual(getWipEmbed(msg), {});
});

test('reads the wip embed from the second embed slot', () => {
 const msg: BuilderMessageLike = {
  embeds: [{ url: buildMarkerUrl({ execId: '1' }) }, { title: 'Hello' }],
 };
 assert.deepEqual(getWipEmbed(msg), { title: 'Hello' });
});

test('reads selected field and property from select defaults', () => {
 const msg = {
  embeds: [],
  components: [
   selectRow(EmbedBuilderRoute.Property, [
    { value: EmbedProperty.Title },
    { value: EmbedProperty.Description, selected: true },
   ]),
   selectRow(EmbedBuilderRoute.Field, [{ value: '0' }, { value: '1', selected: true }]),
  ],
 } as unknown as BuilderMessageLike;

 assert.equal(getSelectedProperty(msg), EmbedProperty.Description);
 assert.equal(getSelectedField(msg), 1);
});

test('returns null selections when nothing is marked default', () => {
 const msg = {
  embeds: [],
  components: [selectRow(EmbedBuilderRoute.Field, [{ value: 'add' }])],
 } as unknown as BuilderMessageLike;
 assert.equal(getSelectedProperty(msg), null);
 assert.equal(getSelectedField(msg), null);
});

test('isSendable requires at least one visible property', () => {
 assert.equal(isSendable({}), false);
 assert.equal(isSendable({ color: 0xff0000 }), false);
 assert.equal(isSendable({ title: 'x' }), true);
 assert.equal(isSendable({ fields: [{ name: 'a', value: 'b' }] }), true);
 assert.equal(isSendable({ footer: { text: 'f' } }), true);
});
