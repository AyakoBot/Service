import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ComponentType } from 'discord-api-types/v10';

import {
 encodeContext,
 extractBody,
 findContext,
 findMessageRef,
 TicketContextType,
 withContext,
} from './transcriptContext.js';

const marker = encodeContext(TicketContextType.Forwarded, '111', '222');
const expected = { type: TicketContextType.Forwarded, actorId: '111', refId: '222' };

const header = (accessory: unknown) => [
 {
  type: ComponentType.Container,
  components: [{ type: ComponentType.Section, components: [], accessory }],
 },
];

const button = header({ type: ComponentType.Button, custom_id: marker });
const thumbnail = header({
 type: ComponentType.Thumbnail,
 media: { url: withContext('https://cdn.discordapp.com/avatars/111/abc.png?size=64', marker) },
});

test('reads the marker from an old-style button and from an avatar thumbnail', () => {
 assert.deepEqual(findContext(button), expected);
 assert.deepEqual(findContext(thumbnail), expected);
});

test('finds a mirrored message by its reference in either form', () => {
 assert.equal(findMessageRef(button, '222'), true);
 assert.equal(findMessageRef(thumbnail, '222'), true);
 assert.equal(findMessageRef(thumbnail, '333'), false);
});

test('withContext sets size 1024 and keeps the marker readable with or without a query', () => {
 const sized = new URL(withContext('https://cdn.discordapp.com/icons/1/abc.png?size=64', marker));
 const bare = new URL(withContext('https://cdn.discordapp.com/embed/avatars/0.png', marker));

 assert.equal(sized.searchParams.get('size'), '1024');
 assert.equal(bare.searchParams.get('size'), '1024');
 assert.deepEqual(
  findContext(header({ type: ComponentType.Thumbnail, media: { url: bare.href } })),
  expected,
 );
});

test('skips thumbnails without a marker and keeps looking', () => {
 const components = [
  { type: ComponentType.Thumbnail, media: { url: 'https://example.com/picture.png' } },
  { type: ComponentType.Thumbnail, media: { url: 'not a url' } },
  ...thumbnail,
 ];

 assert.deepEqual(findContext(components), expected);
});

const text = (content: string) => ({ type: ComponentType.TextDisplay, content });
const avatar = {
 type: ComponentType.Thumbnail,
 media: { url: withContext('https://cdn.discordapp.com/avatars/111/abc.webp', marker) },
};
const message = (...components: unknown[]) => [{ type: ComponentType.Container, components }];

test('transcripts of old messages skip the small author line', () => {
 const old = message(
  {
   type: ComponentType.Section,
   components: [text('-# Someone')],
   accessory: { type: ComponentType.Button, custom_id: marker },
  },
  { type: ComponentType.Separator },
  text('Hello there'),
  text('-# timestamp'),
 );

 assert.equal(extractBody(old), 'Hello there');
});

test('transcripts of new messages skip the bold author and rejoin a split message', () => {
 const split = message(
  {
   type: ComponentType.Section,
   components: [text('**Someone**'), text('First part')],
   accessory: avatar,
  },
  text('second part'),
  { type: ComponentType.Separator },
  text('-# timestamp'),
 );
 const whole = message(
  {
   type: ComponentType.Section,
   components: [text('**Someone**'), text('All of it')],
   accessory: avatar,
  },
  { type: ComponentType.Separator },
  text('-# timestamp'),
 );
 const empty = message({
  type: ComponentType.Section,
  components: [text('**Someone**'), text('-# timestamp')],
  accessory: avatar,
 });

 assert.equal(extractBody(split), 'First part second part');
 assert.equal(extractBody(whole), 'All of it');
 assert.equal(extractBody(empty), '');
});
