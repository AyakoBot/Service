import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EmbedProperty } from '../Classes/Properties.js';

import {
 ApplyErrorCode,
 applyProperty,
 blank,
 currentValue,
 parseColor,
 parseTimestamp,
} from './applyProperty.js';

test('sets and clears the title', () => {
 const set = applyProperty({}, EmbedProperty.Title, 'Hello', null);
 assert.ok(set.ok);
 assert.equal(set.embed.title, 'Hello');

 const cleared = applyProperty(set.embed, EmbedProperty.Title, null, null);
 assert.ok(cleared.ok);
 assert.equal(cleared.embed.title, undefined);
});

test('clamps values to the property limit', () => {
 const result = applyProperty({}, EmbedProperty.Title, 'a'.repeat(300), null);
 assert.ok(result.ok);
 assert.equal(result.embed.title?.length, 256);
});

test('parses colors and rejects invalid ones', () => {
 assert.equal(parseColor('#5865F2'), 0x5865f2);
 assert.equal(parseColor('5865f2'), 0x5865f2);
 assert.equal(parseColor('xyz'), null);

 const bad = applyProperty({}, EmbedProperty.Color, 'nope', null);
 assert.ok(!bad.ok && bad.error === ApplyErrorCode.InvalidColor);
});

test('parses timestamps from unix seconds and t-tags', () => {
 assert.equal(parseTimestamp('1718200000'), new Date(1718200000 * 1000).toISOString());
 assert.equal(parseTimestamp('<t:1718200000:f>'), new Date(1718200000 * 1000).toISOString());
 assert.equal(parseTimestamp('not a date'), null);
});

test('rejects non-http urls', () => {
 const bad = applyProperty({}, EmbedProperty.Image, 'ftp://x/y.png', null);
 assert.ok(!bad.ok && bad.error === ApplyErrorCode.InvalidUrl);

 const good = applyProperty({}, EmbedProperty.Image, 'https://x/y.png', null);
 assert.ok(good.ok);
 assert.equal(good.embed.image?.url, 'https://x/y.png');
});

test('keeps the author object alive while any part is set', () => {
 const withIcon = applyProperty({}, EmbedProperty.AuthorIcon, 'https://x/a.png', null);
 assert.ok(withIcon.ok);
 assert.equal(withIcon.embed.author?.name, blank);

 const named = applyProperty(withIcon.embed, EmbedProperty.AuthorName, 'Ann', null);
 assert.ok(named.ok);
 assert.equal(named.embed.author?.name, 'Ann');

 const iconGone = applyProperty(named.embed, EmbedProperty.AuthorIcon, null, null);
 assert.ok(iconGone.ok);
 assert.equal(iconGone.embed.author?.icon_url, undefined);
 assert.equal(iconGone.embed.author?.name, 'Ann');

 const allGone = applyProperty(iconGone.embed, EmbedProperty.AuthorName, null, null);
 assert.ok(allGone.ok);
 assert.equal(allGone.embed.author, undefined);
});

test('drops the footer when text and icon are both cleared', () => {
 const withText = applyProperty({}, EmbedProperty.FooterText, 'foot', null);
 assert.ok(withText.ok);

 const cleared = applyProperty(withText.embed, EmbedProperty.FooterText, null, null);
 assert.ok(cleared.ok);
 assert.equal(cleared.embed.footer, undefined);
});

test('edits fields only when one is selected', () => {
 const noField = applyProperty({}, EmbedProperty.FieldName, 'x', null);
 assert.ok(!noField.ok && noField.error === ApplyErrorCode.NoFieldSelected);

 const embed = { fields: [{ name: 'a', value: 'b' }] };
 const renamed = applyProperty(embed, EmbedProperty.FieldName, 'new', 0);
 assert.ok(renamed.ok);
 assert.equal(renamed.embed.fields?.[0].name, 'new');

 const toggled = applyProperty(renamed.embed, EmbedProperty.FieldInline, null, 0);
 assert.ok(toggled.ok);
 assert.equal(toggled.embed.fields?.[0].inline, true);
});

test('currentValue reads back what applyProperty wrote', () => {
 const result = applyProperty({}, EmbedProperty.Color, '#ff0000', null);
 assert.ok(result.ok);
 assert.equal(currentValue(result.embed, EmbedProperty.Color, null), '#ff0000');
 assert.equal(currentValue({}, EmbedProperty.Color, null), '');
});
