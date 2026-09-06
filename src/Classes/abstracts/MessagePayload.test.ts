import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ComponentType, MessageFlags } from 'discord-api-types/v10';

import type Client from '../Client.js';

import { MessagePayload } from './MessagePayload.js';

const client = {} as typeof Client.prototype;
const file = { data: Buffer.from('x'), name: 'Raw_Message.txt' };
const container = {
 type: ComponentType.Container,
 components: [{ type: ComponentType.TextDisplay, content: 'preview' }],
};

const build = () => new MessagePayload(client, { origin: 'test', reason: 'test' });

const fileComponents = (components: unknown) =>
 (components as { type: number }[] | undefined)?.filter((c) => c.type === ComponentType.File) ?? [];

test('a Components V2 payload exposes its attachments as File components', () => {
 const payload = build()
  .setFlags(MessageFlags.IsComponentsV2)
  .setComponents([container as never])
  .setFiles([file]);

 const files = fileComponents(payload.getAPIPayload().components);

 assert.equal(files.length, 1);
 assert.deepEqual(files[0], {
  type: ComponentType.File,
  file: { url: 'attachment://Raw_Message.txt' },
 });
});

test('an attachment the caller already referenced is not duplicated', () => {
 const payload = build()
  .setFlags(MessageFlags.IsComponentsV2)
  .setComponents([
   container as never,
   { type: ComponentType.File, file: { url: 'attachment://Raw_Message.txt' } } as never,
  ])
  .setFiles([file]);

 assert.equal(fileComponents(payload.getAPIPayload().components).length, 1);
});

test('a classic payload is left alone, since Discord renders its attachments natively', () => {
 const payload = build().setEmbeds([{ description: 'hi' }]).setFiles([file]);

 assert.equal(payload.getAPIPayload().components, undefined);
});

test('a Components V2 payload without attachments keeps its components untouched', () => {
 const payload = build().setFlags(MessageFlags.IsComponentsV2).setComponents([container as never]);

 assert.equal(fileComponents(payload.getAPIPayload().components).length, 0);
 assert.equal(payload.getAPIPayload().components?.length, 1);
});
