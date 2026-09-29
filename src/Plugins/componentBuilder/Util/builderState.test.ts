import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
 ButtonStyle,
 ComponentType,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import {
 buildMarkerUrl,
 ChromeComponentId,
 getNodePage,
 getSelectedPath,
 getWipTree,
 isSendable,
 parseMarker,
} from './builderState.js';
import { makeText } from './componentTree.js';

const markerRow = (url: string): APIMessageTopLevelComponent => ({
 type: ComponentType.ActionRow,
 components: [{ type: ComponentType.Button, style: ButtonStyle.Link, url, label: 'i' }],
});

const markerHeader = (url: string): APIMessageTopLevelComponent => ({
 type: ComponentType.Section,
 components: [makeText('Component Builder')],
 accessory: { type: ComponentType.Button, style: ButtonStyle.Link, url, disabled: true },
});

const nodeSelect = (customId: string, selected: string | null): APIMessageTopLevelComponent =>
 ({
  type: ComponentType.ActionRow,
  components: [
   {
    type: ComponentType.StringSelect,
    custom_id: customId,
    options: [
     { label: 'a', value: '0', default: selected === '0' },
     { label: 'b', value: '1.a', default: selected === '1.a' },
     { label: 'next', value: 'page:next', default: false },
    ],
   },
  ],
 }) as APIMessageTopLevelComponent;

test('marker survives a build/parse round trip, design id included', () => {
 const url = buildMarkerUrl({
  execId: '123',
  designId: '456',
  webhookName: 'Hook',
  webhookAvatar: 'https://cdn.example.com/a.png',
 });

 assert.deepEqual(parseMarker({ components: [markerRow(url)] }), {
  execId: '123',
  designId: '456',
  webhookName: 'Hook',
  webhookAvatar: 'https://cdn.example.com/a.png',
 });
});

test('parseMarker reads the disabled header marker and leaves the design id unset when absent', () => {
 const url = buildMarkerUrl({ execId: '123' });

 assert.deepEqual(parseMarker({ components: [markerHeader(url)] }), {
  execId: '123',
  designId: undefined,
  webhookName: undefined,
  webhookAvatar: undefined,
 });
});

test('parseMarker ignores foreign link buttons and missing exec ids', () => {
 assert.equal(parseMarker({ components: [markerRow('https://example.com/')] }), null);
 assert.equal(
  parseMarker({ components: [markerRow('https://ayakobot.com/?isComponentBuilder=true')] }),
  null,
 );
 assert.equal(parseMarker({}), null);
});

test('getWipTree reads the whole design message and hides the placeholder', () => {
 const wip = makeText('real content');

 assert.deepEqual(getWipTree({ components: [{ ...wip, id: 3 }] }), [wip]);
 assert.deepEqual(
  getWipTree({ components: [{ ...makeText('placeholder'), id: ChromeComponentId.Placeholder }] }),
  [],
 );
 assert.deepEqual(getWipTree({}), []);
});

test('getSelectedPath reads the node select default and ignores page options', () => {
 assert.equal(getSelectedPath({ components: [nodeSelect('components/node_0', '1.a')] }), '1.a');
 assert.equal(getSelectedPath({ components: [nodeSelect('components/node_0', null)] }), null);
});

test('getNodePage reads the page from the node select custom id', () => {
 assert.equal(getNodePage({ components: [nodeSelect('components/node_1', null)] }), 1);
 assert.equal(getNodePage({ components: [nodeSelect('components/node', null)] }), 0);
 assert.equal(getNodePage({}), 0);
});

test('isSendable requires content and a valid tree', () => {
 assert.equal(isSendable([]), false);
 assert.equal(isSendable([makeText('hi')]), true);
 assert.equal(isSendable([makeText('')]), false);
});
