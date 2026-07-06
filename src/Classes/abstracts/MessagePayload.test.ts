import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { API as CustomAPI } from '@ayako/api';

import type Client from '../Client.js';

import { MessagePayload } from './MessagePayload.js';

test('edit reuses a provided api and never re-resolves getAPI', async () => {
 let editedWith: string | null = null;
 let getApiCalls = 0;

 const client = {
  getAPI: async () => {
   getApiCalls += 1;
   throw new Error('getAPI must not be called when an api is provided');
  },
 } as unknown as typeof Client.prototype;

 const api = {
  channels: {
   editMessage: (channelId: string) => {
    editedWith = channelId;
    return undefined;
   },
  },
 } as unknown as CustomAPI;

 const payload = new MessagePayload(client, { origin: 'test', reason: 'test' });
 await payload.edit('chan', 'msg', 'guild', api);

 assert.equal(editedWith, 'chan');
 assert.equal(getApiCalls, 0);
});
