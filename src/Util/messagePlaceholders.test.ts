import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MessagePlaceholder, placeholderDoc } from './messagePlaceholders.js';

test('placeholderDoc lists the shared set plus the plugin extras', () => {
 assert.equal(
  placeholderDoc(MessagePlaceholder.Gif),
  '`{{user}}` `{{username}}` `{{displayname}}` `{{server}}` `{{membercount}}` `{{gif}}`',
 );
 assert.equal(placeholderDoc().includes('{{gif}}'), false);
});
