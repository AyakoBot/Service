import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
 ButtonStyle,
 ComponentType,
 type APIButtonComponentWithCustomId,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { nextButtonStyle } from './buttonCycle.js';

type CustomIdStyle = APIButtonComponentWithCustomId['style'];

const id = 'embeds/placeholders';

const rowWith = (customId: string, style: CustomIdStyle): APIMessageTopLevelComponent => ({
 type: ComponentType.ActionRow,
 components: [
  { type: ComponentType.Button, style: ButtonStyle.Secondary, custom_id: 'embeds/export', label: 'Export' },
  { type: ComponentType.Button, style, custom_id: customId, label: 'Placeholders' },
 ],
});

test('advances blurple, green, red, grey and wraps back to blurple', () => {
 const order: CustomIdStyle[] = [
  ButtonStyle.Primary,
  ButtonStyle.Success,
  ButtonStyle.Danger,
  ButtonStyle.Secondary,
 ];

 order.forEach((style, index) => {
  assert.equal(nextButtonStyle([rowWith(id, style)], id), order[(index + 1) % order.length]);
 });
});

test('starts at blurple without a previous button', () => {
 assert.equal(nextButtonStyle(undefined, id), ButtonStyle.Primary);
 assert.equal(nextButtonStyle([], id), ButtonStyle.Primary);
 assert.equal(nextButtonStyle([rowWith('embeds/other', ButtonStyle.Danger)], id), ButtonStyle.Primary);
});
