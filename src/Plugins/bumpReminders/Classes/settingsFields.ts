import { BumpMatchSource, type BumpReminderSetting } from '@ayako/database';

import type {
 RowGuardContext,
 ShowIfResult,
 TransformResult,
} from '../../settings/SettingsSchema.js';
import en from '../Language/en-GB.json' with { type: 'json' };
import type { BumpRemindersTranslator } from '../Plugin.js';

import { providerTemplates } from './Providers.js';

type Option = { label: (t: BumpRemindersTranslator) => string; value: string };

const minCooldownSeconds = 60;

export const matchSourceOptions: Option[] = [
 {
  label: (t) => t.settings.matchSources.content(),
  value: BumpMatchSource.Content,
 },
 {
  label: (t) => t.settings.matchSources.embedTitle(),
  value: BumpMatchSource.EmbedTitle,
 },
 {
  label: (t) => t.settings.matchSources.embedDescription(),
  value: BumpMatchSource.EmbedDescription,
 },
 {
  label: (t) => t.settings.matchSources.embedAuthorName(),
  value: BumpMatchSource.EmbedAuthorName,
 },
 {
  label: (t) => t.settings.matchSources.embedFooterText(),
  value: BumpMatchSource.EmbedFooterText,
 },
 {
  label: (t) => t.settings.matchSources.embedFieldName(),
  value: BumpMatchSource.EmbedFieldName,
 },
 {
  label: (t) => t.settings.matchSources.embedFieldValue(),
  value: BumpMatchSource.EmbedFieldValue,
 },
];

export const templateOptions: Option[] = providerTemplates.map((template) => ({
 label: () => template.name,
 value: template.name,
}));

export const requiredWhileActive =
 (reason: string) =>
 (value: unknown, row: BumpReminderSetting): ShowIfResult => ({
  ok: !row.active || Boolean(typeof value === 'string' && value.trim().length),
  reason,
 });

export const cooldownIsSane = (value: unknown): ShowIfResult => {
 const seconds = Number(value);

 return Number.isFinite(seconds) && seconds >= minCooldownSeconds
  ? { ok: true }
  : { ok: false, reason: en.errors.cooldownTooShort };
};

export const templateVirtual = {
 read: async (row: BumpReminderSetting) => row.template,
 write: async (value: unknown, row: BumpReminderSetting, ctx: RowGuardContext) => {
  const template = providerTemplates.find((entry) => entry.name === value);
  const where = { id: row.id, guild: ctx.guildId };

  if (!template) {
   await ctx.client.db.client.bumpReminderSetting.updateMany({
    where,
    data: { template: null },
   });

   return { ok: true };
  }

  const named = row.name?.trim().length && row.name !== row.template;

  await ctx.client.db.client.bumpReminderSetting.updateMany({
   where,
   data: {
    template: template.name,
    name: named ? row.name : template.name,
    botId: template.botId,
    cooldownSeconds: template.cooldownSeconds,
    commandName: template.commandName,
    commandId: template.commandId,
    matchSource: template.matchSource,
    matchText: template.matchText,
   },
  });

  return { ok: true };
 },
};

export const commandNameTransform = async (value: unknown): Promise<TransformResult> => ({
 value: typeof value === 'string' ? value.trim().replace(/^\//, '') : value,
});
