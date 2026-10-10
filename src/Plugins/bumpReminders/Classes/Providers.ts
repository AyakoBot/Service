import { BumpMatchSource, type BumpReminderSetting } from '@ayako/database';
import type { GatewayDispatchEvents } from '@discordjs/core';

import type { ExtractPayload } from '../../../Types/gateway.js';

type BumpMessage = ExtractPayload<GatewayDispatchEvents.MessageCreate>;

export type ProviderTemplate = {
 name: string;
 botId: string;
 cooldownSeconds: number;
 commandName: string;
 commandId: string | null;
 matchSource: BumpMatchSource;
 matchText: string;
};

export const providerTemplates: ProviderTemplate[] = [
 {
  name: 'DISBOARD',
  botId: '302050872383242240',
  cooldownSeconds: 9000,
  commandName: 'bump',
  commandId: '947088344167366698',
  matchSource: BumpMatchSource.EmbedDescription,
  matchText: 'Bump done!',
 },
 {
  name: 'Carl-bot',
  botId: '235148962103951360',
  cooldownSeconds: 21600,
  commandName: 'bump',
  commandId: '1496464365929496707',
  matchSource: BumpMatchSource.Content,
  matchText: "You've successfully bumped this server",
 },
 {
  name: 'D-ify.net',
  botId: '1326784586696626176',
  cooldownSeconds: 7200,
  commandName: 'bump',
  commandId: '1530949916233306364',
  matchSource: BumpMatchSource.EmbedAuthorName,
  matchText: 'bumped this server on Discordify!',
 },
];

const embeds = (msg: BumpMessage) => msg.embeds ?? [];

const haystacks: Record<BumpMatchSource, (msg: BumpMessage) => (string | undefined)[]> = {
 [BumpMatchSource.Content]: (msg) => [msg.content],
 [BumpMatchSource.EmbedTitle]: (msg) => embeds(msg).map((e) => e.title),
 [BumpMatchSource.EmbedDescription]: (msg) => embeds(msg).map((e) => e.description),
 [BumpMatchSource.EmbedAuthorName]: (msg) => embeds(msg).map((e) => e.author?.name),
 [BumpMatchSource.EmbedFooterText]: (msg) => embeds(msg).map((e) => e.footer?.text),
 [BumpMatchSource.EmbedFieldName]: (msg) =>
  embeds(msg).flatMap((e) => (e.fields ?? []).map((f) => f.name)),
 [BumpMatchSource.EmbedFieldValue]: (msg) =>
  embeds(msg).flatMap((e) => (e.fields ?? []).map((f) => f.value)),
};

export const isConfigured = (setting: BumpReminderSetting): boolean =>
 Boolean(setting.botId?.length && setting.matchText?.trim().length);

export const matches = (setting: BumpReminderSetting, msg: BumpMessage): boolean => {
 if (!isConfigured(setting)) return false;

 const needle = setting.matchText?.trim().toLowerCase() ?? '';

 return haystacks[setting.matchSource](msg).some((value) =>
  Boolean(value?.toLowerCase().includes(needle)),
 );
};

export const providerName = (setting: BumpReminderSetting, fallback: string): string =>
 (setting.name?.trim().length ? setting.name.trim() : fallback);

export const bumpCommand = (setting: BumpReminderSetting): string | null => {
 const name = setting.commandName?.trim().replace(/^\//, '');
 if (!name?.length) return null;

 return setting.commandId?.length ? `</${name}:${setting.commandId}>` : `\`/${name}\``;
};
