import assert from 'node:assert';
import { test } from 'node:test';

import { ChannelType } from 'discord-api-types/v10';

import { channelBanTarget, isThreadType } from './resolveChannelBanTarget.js';

test('isThreadType recognizes only thread channel types', () => {
 assert.strictEqual(isThreadType(ChannelType.PublicThread), true);
 assert.strictEqual(isThreadType(ChannelType.PrivateThread), true);
 assert.strictEqual(isThreadType(ChannelType.AnnouncementThread), true);
 assert.strictEqual(isThreadType(ChannelType.GuildText), false);
 assert.strictEqual(isThreadType(ChannelType.GuildCategory), false);
 assert.strictEqual(isThreadType(null), false);
 assert.strictEqual(isThreadType(undefined), false);
});

test('channelBanTarget remaps a thread to its parent but leaves categorized channels alone (GX-22)', () => {
 assert.strictEqual(
  channelBanTarget({ type: ChannelType.PublicThread, parent_id: 'PARENT' }, 'THREAD'),
  'PARENT',
 );
 assert.strictEqual(
  channelBanTarget({ type: ChannelType.PrivateThread, parent_id: 'PARENT' }, 'THREAD'),
  'PARENT',
 );
 assert.strictEqual(
  channelBanTarget({ type: ChannelType.GuildText, parent_id: 'CATEGORY' }, 'CHANNEL'),
  'CHANNEL',
 );
 assert.strictEqual(channelBanTarget(null, 'CHANNEL'), 'CHANNEL');
 assert.strictEqual(
  channelBanTarget({ type: ChannelType.PublicThread, parent_id: null }, 'THREAD'),
  'THREAD',
 );
});
