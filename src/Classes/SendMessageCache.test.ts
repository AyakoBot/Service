import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { API as CustomAPI } from '@ayako/api';
import type { CreateMessageOptions } from '@discordjs/core';
import { ComponentType, MessageFlags } from 'discord-api-types/v10';

import { MessagePayload } from './abstracts/MessagePayload.js';
import type Client from './Client.js';
import SendMessageCache from './SendMessageCache.js';

const tick = () =>
 new Promise((resolve) => {
  setImmediate(resolve);
 });

test('a CV2 payload never merges into an open embed window', async () => {
 const calls: CreateMessageOptions[] = [];

 const api = {
  channels: {
   createMessage: async (_channelId: string, options: CreateMessageOptions) => {
    calls.push(options);
    return { id: String(calls.length) };
   },
  },
  emit: () => undefined,
 } as unknown as CustomAPI;

 const client = {
  getAPI: async () => api,
  cache: { messages: { apiToR: () => undefined } },
 } as unknown as typeof Client.prototype;

 const cache = new SendMessageCache(client);

 const embedPayload = new MessagePayload(client, { origin: 'test', reason: 'test' }).setEmbeds([
  { description: 'embed' },
 ]);

 const cv2Payload = new MessagePayload(client, { origin: 'test', reason: 'test' })
  .setFlags(MessageFlags.IsComponentsV2)
  .setComponents([{ type: ComponentType.TextDisplay, content: 'cv2' }]);

 void cache.queueMessage('chan', 'guild', embedPayload, 10_000);
 await tick();
 await cache.queueMessage('chan', 'guild', cv2Payload, 0);
 await tick();

 assert.equal(calls.length, 2);
 assert.ok(
  !calls.some((c) => Boolean((c.flags ?? 0) & MessageFlags.IsComponentsV2) && !!c.embeds?.length),
 );
});
