import assert from 'node:assert/strict';
import { test } from 'node:test';

import { detectMessageJsonKind, MessageJsonKind } from './messageJsonKind.js';

test('cv2-flagged message export => componentsV2', () => {
 assert.equal(
  detectMessageJsonKind({ flags: 32768, components: [{ type: 17, components: [] }] }),
  MessageJsonKind.ComponentsV2,
 );
});

test('unflagged message with cv2 top-level components => componentsV2', () => {
 assert.equal(
  detectMessageJsonKind({ components: [{ type: 10, content: 'hi' }] }),
  MessageJsonKind.ComponentsV2,
 );
});

test('discohook message export with embeds and legacy button rows => embeds', () => {
 assert.equal(
  detectMessageJsonKind({
   content: 'hi',
   embeds: [{ title: 'Support' }],
   components: [{ type: 1, components: [{ type: 2, label: 'x' }] }],
  }),
  MessageJsonKind.Embeds,
 );
});

test('bare embed object and embed array => embeds', () => {
 assert.equal(detectMessageJsonKind({ title: 'Support' }), MessageJsonKind.Embeds);
 assert.equal(
  detectMessageJsonKind([{ type: 'rich', description: 'x' }]),
  MessageJsonKind.Embeds,
 );
});

test('component arrays and single components => componentsV2', () => {
 assert.equal(
  detectMessageJsonKind([{ type: 17, components: [] }]),
  MessageJsonKind.ComponentsV2,
 );
 assert.equal(detectMessageJsonKind({ type: 10, content: 'x' }), MessageJsonKind.ComponentsV2);
});

test('non-objects and empty arrays => unknown', () => {
 assert.equal(detectMessageJsonKind('hi'), MessageJsonKind.Unknown);
 assert.equal(detectMessageJsonKind(null), MessageJsonKind.Unknown);
 assert.equal(detectMessageJsonKind([]), MessageJsonKind.Unknown);
});
