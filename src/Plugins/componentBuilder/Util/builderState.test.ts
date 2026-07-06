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
 getSelectedPath,
 getWipTree,
 isSendable,
 parseMarker,
} from './builderState.js';
import { makeSeparator, makeText } from './componentTree.js';

const markerRow = (url: string): APIMessageTopLevelComponent => ({
 type: ComponentType.ActionRow,
 components: [{ type: ComponentType.Button, style: ButtonStyle.Link, url, label: 'i' }],
});

const boundary = (): APIMessageTopLevelComponent => ({
 ...makeSeparator(),
 id: ChromeComponentId.Boundary,
});

test('marker survives a build/parse round trip', () => {
 const url = buildMarkerUrl({
  execId: '123',
  webhookName: 'Hook',
  webhookAvatar: 'https://cdn.example.com/a.png',
 });
 const marker = parseMarker({ components: [markerRow(url)] });
 assert.deepEqual(marker, {
  execId: '123',
  webhookName: 'Hook',
  webhookAvatar: 'https://cdn.example.com/a.png',
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

test('getWipTree slices after the boundary and hides the placeholder', () => {
 const wip = makeText('real content');
 const msg = {
  components: [makeText('chrome'), boundary(), { ...wip, id: 3 }],
 };
 assert.deepEqual(getWipTree(msg), [wip]);

 const placeholder = {
  components: [
   makeText('chrome'),
   boundary(),
   { ...makeText('placeholder'), id: ChromeComponentId.Placeholder },
  ],
 };
 assert.deepEqual(getWipTree(placeholder), []);

 assert.deepEqual(getWipTree({ components: [makeText('no boundary')] }), []);
});

test('getSelectedPath reads the node select default before the boundary', () => {
 const msg = {
  components: [
   {
    type: ComponentType.ActionRow,
    components: [
     {
      type: ComponentType.StringSelect,
      custom_id: 'components/node',
      options: [
       { label: 'a', value: '0', default: false },
       { label: 'b', value: '1.a', default: true },
      ],
     },
    ],
   } as APIMessageTopLevelComponent,
   boundary(),
  ],
 };
 assert.equal(getSelectedPath(msg), '1.a');
 assert.equal(getSelectedPath({ components: [boundary()] }), null);
});

test('isSendable requires content and a valid tree', () => {
 assert.equal(isSendable([]), false);
 assert.equal(isSendable([makeText('hi')]), true);
 assert.equal(isSendable([makeText('')]), false);
});
