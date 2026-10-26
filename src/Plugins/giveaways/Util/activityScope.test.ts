import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inScope, rulesFrom, voiceCounts } from './activityScope.js';

const rules = { countMuted: false, countDeafened: false };

test('an empty allow list counts every channel', () => {
 assert.equal(inScope([], ['channel', 'category']), true);
});

test('a thread counts through its channel or its category', () => {
 assert.equal(inScope(['category'], ['thread', 'channel', 'category']), true);
 assert.equal(inScope(['channel'], ['thread', 'channel', null]), true);
 assert.equal(inScope(['elsewhere'], ['thread', 'channel', 'category']), false);
});

test('muted and deafened members only count when allowed', () => {
 assert.equal(voiceCounts({}, rules), true);
 assert.equal(voiceCounts({ self_mute: true }, rules), false);
 assert.equal(voiceCounts({ self_mute: true }, { ...rules, countMuted: true }), true);
});

test('deafening, which also mutes, follows the deafened rule alone', () => {
 const deafened = { self_deaf: true, self_mute: true };

 assert.equal(voiceCounts(deafened, { countMuted: false, countDeafened: true }), true);
 assert.equal(voiceCounts(deafened, { countMuted: true, countDeafened: false }), false);
});

test('the minimum members never drops below one', () => {
 const base = {
  messageChannels: [],
  voiceChannels: [],
  voiceCountMuted: false,
  voiceCountDeafened: false,
 };

 assert.equal(rulesFrom({ ...base, voiceMinMembers: 0 as never }).minMembers, 1);
 assert.equal(rulesFrom({ ...base, voiceMinMembers: 3 as never }).minMembers, 3);
});
