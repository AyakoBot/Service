import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BumpMatchSource, type BumpReminderSetting } from '@ayako/database';

import { bumpCommand, isConfigured, matches, providerTemplates } from './Providers.js';

const setting = (overrides: Partial<BumpReminderSetting>) =>
 ({
  id: '1',
  guild: '2',
  active: true,
  name: null,
  template: null,
  botId: '302050872383242240',
  cooldownSeconds: 9000,
  commandName: null,
  commandId: null,
  matchSource: BumpMatchSource.Content,
  matchText: null,
  channel: null,
  deleteReply: false,
  roles: [],
  users: [],
  repeatEnabled: false,
  repeatReminder: 3600,
  ...overrides,
 }) as unknown as BumpReminderSetting;

const message = (overrides: Record<string, unknown>) =>
 ({ content: '', embeds: [], ...overrides }) as never;

describe('matches', () => {
 it('is false until a bot and a needle are configured', () => {
  assert.equal(isConfigured(setting({ matchText: null })), false);
  assert.equal(isConfigured(setting({ botId: null, matchText: 'x' })), false);
  assert.equal(isConfigured(setting({ matchText: '   ' })), false);
  assert.equal(matches(setting({ matchText: null }), message({ content: 'anything' })), false);
 });

 it('matches message content case-insensitively', () => {
  const s = setting({ matchSource: BumpMatchSource.Content, matchText: 'bumped this server' });

  assert.equal(matches(s, message({ content: "You've successfully BUMPED THIS SERVER" })), true);
  assert.equal(matches(s, message({ content: 'nothing here' })), false);
 });

 it('searches every embed, not just the first', () => {
  const s = setting({ matchSource: BumpMatchSource.EmbedDescription, matchText: 'Bump done!' });

  assert.equal(
   matches(s, message({ embeds: [{ description: 'nope' }, { description: 'Bump done!' }] })),
   true,
  );
 });

 it('searches across all embed fields', () => {
  const byName = setting({ matchSource: BumpMatchSource.EmbedFieldName, matchText: 'Status' });
  const byValue = setting({ matchSource: BumpMatchSource.EmbedFieldValue, matchText: 'bumped' });
  const msg = message({
   embeds: [{ fields: [{ name: 'Other', value: 'x' }, { name: 'Status', value: 'Bumped!' }] }],
  });

  assert.equal(matches(byName, msg), true);
  assert.equal(matches(byValue, msg), true);
 });

 it('does not confuse one source for another', () => {
  const s = setting({ matchSource: BumpMatchSource.EmbedTitle, matchText: 'Bump done!' });

  assert.equal(matches(s, message({ content: 'Bump done!' })), false);
  assert.equal(matches(s, message({ embeds: [{ description: 'Bump done!' }] })), false);
  assert.equal(matches(s, message({ embeds: [{ title: 'Bump done!' }] })), true);
 });

 it('tolerates absent embeds and fields', () => {
  const s = setting({ matchSource: BumpMatchSource.EmbedFieldValue, matchText: 'x' });

  assert.equal(matches(s, message({ embeds: undefined })), false);
  assert.equal(matches(s, message({ embeds: [{}] })), false);
 });
});

describe('bumpCommand', () => {
 it('renders a clickable mention when the id is known', () => {
  assert.equal(
   bumpCommand(setting({ commandName: 'bump', commandId: '947088344167366698' })),
   '</bump:947088344167366698>',
  );
 });

 it('falls back to plain text without an id, and tolerates a leading slash', () => {
  assert.equal(bumpCommand(setting({ commandName: '/bump' })), '`/bump`');
 });

 it('is null when no command is configured', () => {
  assert.equal(bumpCommand(setting({ commandName: null })), null);
  assert.equal(bumpCommand(setting({ commandName: '  ' })), null);
 });
});

describe('providerTemplates', () => {
 it('every template is self-consistent and would match its own bot', () => {
  assert.ok(providerTemplates.length);

  providerTemplates.forEach((template) => {
   const s = setting({
    botId: template.botId,
    matchSource: template.matchSource,
    matchText: template.matchText,
   });

   assert.equal(isConfigured(s), true, template.name);
   assert.ok(template.cooldownSeconds > 0, template.name);
  });
 });

 it('the shipped Disboard template detects a real Disboard confirmation', () => {
  const disboard = providerTemplates.find((t) => t.name === 'DISBOARD');
  assert.ok(disboard);

  const s = setting({ matchSource: disboard.matchSource, matchText: disboard.matchText });
  assert.equal(matches(s, message({ embeds: [{ description: 'Bump done! :thumbsup:' }] })), true);
 });
});
