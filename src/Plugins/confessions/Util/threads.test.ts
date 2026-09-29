import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ChannelType } from 'discord-api-types/v10';

import { PostMode, postModeFor, removalTargets, replyTarget } from './threads.js';

describe('confessions post mode', () => {
 it('makes every confession its own forum post, whatever autoThread says', () => {
  assert.equal(postModeFor(ChannelType.GuildForum, false), PostMode.ForumPost);
  assert.equal(postModeFor(ChannelType.GuildForum, true), PostMode.ForumPost);
 });

 it('posts a plain message in text and announcement channels', () => {
  assert.equal(postModeFor(ChannelType.GuildText, false), PostMode.Message);
  assert.equal(postModeFor(ChannelType.GuildAnnouncement, false), PostMode.Message);
 });

 it('opens a thread under the message when autoThread is on', () => {
  assert.equal(postModeFor(ChannelType.GuildText, true), PostMode.ThreadedMessage);
  assert.equal(postModeFor(ChannelType.GuildAnnouncement, true), PostMode.ThreadedMessage);
 });

 it('falls back to a plain message when the channel type is unknown', () => {
  assert.equal(postModeFor(undefined, false), PostMode.Message);
 });
});

describe('confessions removal targets', () => {
 it('deletes only the thread for a forum post, whose starter message lives inside it', () => {
  assert.deepEqual(removalTargets('t1', 't1'), { thread: 't1', message: false });
 });

 it('deletes both message and thread when the thread hangs off a message and shares its id', () => {
  assert.deepEqual(removalTargets('c1', 'm1'), { thread: 'm1', message: true });
 });

 it('deletes only the message when there is no thread', () => {
  assert.deepEqual(removalTargets('c1', null), { thread: null, message: true });
 });
});

describe('confession reply placement', () => {
 it('posts into the forum post itself', () => {
  assert.deepEqual(replyTarget({ channel: 't1', message: 't1', thread: 't1' }), {
   channel: 't1',
   replyTo: null,
  });
 });

 it('posts into the discussion thread under a normal post', () => {
  assert.deepEqual(replyTarget({ channel: 'c1', message: 'm1', thread: 'm1' }), {
   channel: 'm1',
   replyTo: null,
  });
 });

 it('replies to the confession in the channel when there is no thread', () => {
  assert.deepEqual(replyTarget({ channel: 'c1', message: 'm1', thread: null }), {
   channel: 'c1',
   replyTo: 'm1',
  });
 });
});
