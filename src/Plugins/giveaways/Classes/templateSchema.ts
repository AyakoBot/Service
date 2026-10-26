import { GiveawayEnforcement, type GiveawayTemplate } from '@ayako/database';

import { PluginName } from '../../../Classes/abstracts/Plugin.js';
import { EmoteName } from '../../../Classes/EmoteName.js';
import type { CommandMention } from '../../../Util/commandMention.js';
import { createCrossAdvert } from '../../../Util/crossAdvert.js';
import { renderPlaceholderList } from '../../../Util/messagePlaceholders.js';
import parseHttpUrl from '../../../Util/parseHttpUrl.js';
import { PluginBotKey } from '../../../Util/pluginBotKey.js';
import { savedDesignField } from '../../../Util/savedRef.js';
import { EditorType } from '../../settings/EditorType.js';
import {
 FieldArity,
 type FieldTransform,
 type SettingsFieldVirtual,
 type SettingsSchemaDef,
} from '../../settings/SettingsSchema.js';
import {
 designReserve,
 giveawayChannelTypes,
 giveawayPlaceholders,
 maxBonusEntries,
 maxRecurring,
 maxWinners,
 minRepeatSeconds,
} from '../constants.js';
import en from '../Language/en-GB.json' with { type: 'json' };
import type GiveawaysPlugin from '../Plugin.js';
import type { GiveawaysTranslator } from '../Plugin.js';

import { commandName, GiveawayGroup, GiveawayStartSub } from './Routes.js';
import { claimFloorTransform, colorTransform } from './settingsSchema.js';

export enum GiveawayTemplateGroup {
 Basics = 'basics',
 Entry = 'entry',
 Activity = 'activity',
 Bonus = 'bonus',
 Rewards = 'rewards',
 Appearance = 'appearance',
 Recurring = 'recurring',
}

type TemplateVirtualColumns = {
 design: string | null;
 nextRun: number | null;
};

type Row = GiveawayTemplate & TemplateVirtualColumns;

const placeholderDoc = renderPlaceholderList(giveawayPlaceholders);
const templateCommand = `${commandName} ${GiveawayGroup.Start} ${GiveawayStartSub.FromTemplate}`;

const nameTransform: FieldTransform = async (value, ctx) => {
 const name = String(value ?? '')
  .trim()
  .slice(0, 100);
 if (!name.length) return { value: null };

 const taken = await ctx.client.db.client.giveawayTemplate.findFirst({
  where: { guild: ctx.guildId, name, NOT: { id: ctx.rowId } },
  select: { id: true },
 });

 return taken ? { error: en.errors.templateNameTaken } : { value: name };
};

const urlTransform: FieldTransform = async (value) => {
 const raw = String(value ?? '').trim();
 if (!raw.length) return { value: null };

 const url = parseHttpUrl(raw);
 return url ? { value: url } : { error: en.errors.invalidUrl };
};

const rangeTransform =
 (min: number, max: number, error: string): FieldTransform =>
 async (value) => {
  const number = Number(value);
  if (value === null || value === '' || !Number.isFinite(number)) return { value: null };

  return number >= min && number <= max ? { value: Math.round(number) } : { error };
 };

const repeatTransform: FieldTransform = async (value, ctx) => {
 const seconds = Number(value);
 if (!Number.isFinite(seconds) || seconds <= 0) return { value: null };
 if (seconds < minRepeatSeconds) return { error: en.errors.repeatTooShort };

 const [template, recurring, setting] = await Promise.all([
  ctx.client.db.client.giveawayTemplate.findFirst({
   where: { guild: ctx.guildId, id: ctx.rowId },
   select: { channel: true },
  }),
  ctx.client.db.client.giveawayTemplate.count({
   where: { guild: ctx.guildId, repeatSeconds: { not: null }, NOT: { id: ctx.rowId } },
  }),
  ctx.client.db.client.giveawaySetting.findFirst({
   where: { guild: ctx.guildId },
   select: { logChannel: true },
  }),
 ]);

 if (!template?.channel) return { error: en.errors.templateNoChannel };
 if (!setting?.logChannel) return { error: en.errors.recurringNeedsLog };
 if (recurring >= maxRecurring) return { error: en.errors.tooManyRecurring };

 return { value: seconds };
};

const nextRunVirtual: SettingsFieldVirtual<Row> = {
 read: async (row) =>
  row.nextRunAt ? Math.max(0, Math.round((row.nextRunAt.getTime() - Date.now()) / 1000)) : null,
 write: async (value, row, ctx) => {
  const seconds = Number(Array.isArray(value) ? value[0] : value);
  const nextRunAt =
   Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000) : null;

  await ctx.client.db.client.giveawayTemplate.updateMany({
   where: { id: row.id, guild: row.guild },
   data: { nextRunAt },
  });

  return { ok: true };
 },
};

const advertText = async (plugin: unknown, invite: string) =>
 (await (plugin as GiveawaysPlugin).t(undefined)).templates.currencyAdvert({ invite });

const currencyAdvert = createCrossAdvert<Row>({
 partner: PluginName.Economy,
 partnerKey: PluginBotKey.Economy,
 advert: async (plugin, _stored, invite) => advertText(plugin, invite),
 unavailable: async (plugin, invite) => advertText(plugin, invite),
 read: async (row) => row.currency,
 write: async (value, row, ctx) => {
  const amount = Math.round(Number(Array.isArray(value) ? value[0] : value));

  await ctx.client.db.client.giveawayTemplate.updateMany({
   where: { id: row.id, guild: row.guild },
   data: { currency: Number.isFinite(amount) && amount > 0 ? amount : null },
  });

  return { ok: true };
 },
});

const templateSchema: SettingsSchemaDef = {
 table: 'giveawayTemplate',
 rowKey: 'id',
 multiRow: true,
 title: (t: GiveawaysTranslator) => t.templates.title(),
 overviewDescription: (t: GiveawaysTranslator, mention: CommandMention) =>
  t.templates.overview({ command: mention(templateCommand) }),
 rowLabel: (t: GiveawaysTranslator, row: Row) => row.name ?? t.templates.unnamed(),
 onChange: async (ctx) => {
  await (ctx.plugin as GiveawaysPlugin).templates.rearm(ctx.guildId, ctx.rowId);
 },
 groups: [
  {
   id: GiveawayTemplateGroup.Basics,
   label: (t: GiveawaysTranslator) => t.templates.groups.basics(),
   emote: EmoteName.Gift,
   fields: [
    {
     column: 'name',
     editor: EditorType.String,
     transform: nameTransform,
     label: (t: GiveawaysTranslator) => t.templates.fields.name(),
     description: (t: GiveawaysTranslator, mention: CommandMention) =>
      t.templates.descriptions.name({ command: mention(templateCommand) }),
    },
    {
     column: 'description',
     editor: EditorType.String,
     multiline: true,
     label: (t: GiveawaysTranslator) => t.templates.fields.description(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.description(),
    },
    {
     column: 'prize',
     editor: EditorType.String,
     label: (t: GiveawaysTranslator) => t.templates.fields.prize(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.prize(),
    },
    {
     column: 'channel',
     editor: EditorType.Channel,
     channelTypes: [...giveawayChannelTypes],
     label: (t: GiveawaysTranslator) => t.templates.fields.channel(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.channel(),
    },
    {
     column: 'host',
     editor: EditorType.User,
     label: (t: GiveawaysTranslator) => t.templates.fields.host(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.host(),
    },
    {
     column: 'duration',
     editor: EditorType.Duration,
     label: (t: GiveawaysTranslator) => t.templates.fields.duration(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.duration(),
    },
    {
     column: 'winnerCount',
     editor: EditorType.Number,
     transform: rangeTransform(1, maxWinners, en.errors.invalidWinners),
     label: (t: GiveawaysTranslator) => t.templates.fields.winnerCount(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.winnerCount(),
    },
    {
     column: 'collectSeconds',
     editor: EditorType.Duration,
     transform: claimFloorTransform,
     label: (t: GiveawaysTranslator) => t.templates.fields.collectSeconds(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.collectSeconds(),
    },
    {
     column: 'failReroll',
     editor: EditorType.Boolean,
     label: (t: GiveawaysTranslator) => t.templates.fields.failReroll(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.failReroll(),
    },
   ],
  },
  {
   id: GiveawayTemplateGroup.Entry,
   label: (t: GiveawaysTranslator) => t.templates.groups.entry(),
   emote: EmoteName.Lock,
   fields: [
    {
     column: 'requiredRoles',
     editor: EditorType.Roles,
     arity: FieldArity.Multi,
     label: (t: GiveawaysTranslator) => t.templates.fields.requiredRoles(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.requiredRoles(),
    },
    {
     column: 'excludedRoles',
     editor: EditorType.Roles,
     arity: FieldArity.Multi,
     label: (t: GiveawaysTranslator) => t.templates.fields.excludedRoles(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.excludedRoles(),
    },
    {
     column: 'enforcement',
     editor: EditorType.String,
     arity: FieldArity.Single,
     label: (t: GiveawaysTranslator) => t.templates.fields.enforcement(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.enforcement(),
     options: [
      {
       value: GiveawayEnforcement.onJoin,
       label: (t: GiveawaysTranslator) => t.templates.enforcement.onJoin(),
      },
      {
       value: GiveawayEnforcement.onEnd,
       label: (t: GiveawaysTranslator) => t.templates.enforcement.onEnd(),
      },
     ],
    },
    {
     column: 'minAccountSeconds',
     editor: EditorType.Duration,
     label: (t: GiveawaysTranslator) => t.templates.fields.minAccountSeconds(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.minAccountSeconds(),
    },
    {
     column: 'minTenureSeconds',
     editor: EditorType.Duration,
     label: (t: GiveawaysTranslator) => t.templates.fields.minTenureSeconds(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.minTenureSeconds(),
    },
   ],
  },
  {
   id: GiveawayTemplateGroup.Activity,
   label: (t: GiveawaysTranslator) => t.templates.groups.activity(),
   emote: EmoteName.Curve,
   fields: [
    {
     column: 'minMessages',
     editor: EditorType.Number,
     label: (t: GiveawaysTranslator) => t.templates.fields.minMessages(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.minMessages(),
    },
    {
     column: 'minMessagesSince',
     editor: EditorType.Number,
     label: (t: GiveawaysTranslator) => t.templates.fields.minMessagesSince(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.minMessagesSince(),
    },
    {
     column: 'minVoiceSeconds',
     editor: EditorType.Duration,
     label: (t: GiveawaysTranslator) => t.templates.fields.minVoiceSeconds(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.minVoiceSeconds(),
    },
   ],
  },
  {
   id: GiveawayTemplateGroup.Bonus,
   label: (t: GiveawaysTranslator) => t.templates.groups.bonus(),
   emote: EmoteName.Plus,
   fields: [
    {
     column: 'bonusRoles',
     editor: EditorType.Roles,
     arity: FieldArity.Multi,
     label: (t: GiveawaysTranslator) => t.templates.fields.bonusRoles(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.bonusRoles(),
    },
    {
     column: 'bonusExtra',
     editor: EditorType.Number,
     transform: rangeTransform(1, maxBonusEntries - 1, en.errors.invalidExtra),
     label: (t: GiveawaysTranslator) => t.templates.fields.bonusExtra(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.bonusExtra(),
    },
   ],
  },
  {
   id: GiveawayTemplateGroup.Rewards,
   label: (t: GiveawaysTranslator) => t.templates.groups.rewards(),
   emote: EmoteName.Crown,
   fields: [
    {
     column: 'personalPrizes',
     editor: EditorType.Boolean,
     label: (t: GiveawaysTranslator) => t.templates.fields.personalPrizes(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.personalPrizes(),
    },
    {
     column: 'currency',
     editor: EditorType.Number,
     emote: EmoteName.Coin,
     arity: FieldArity.Single,
     virtual: currencyAdvert,
     label: (t: GiveawaysTranslator) => t.templates.fields.currency(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.currency(),
    },
    {
     column: 'winnerRoles',
     editor: EditorType.Roles,
     arity: FieldArity.Multi,
     label: (t: GiveawaysTranslator) => t.templates.fields.winnerRoles(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.winnerRoles(),
    },
   ],
  },
  {
   id: GiveawayTemplateGroup.Appearance,
   label: (t: GiveawaysTranslator) => t.templates.groups.appearance(),
   emote: EmoteName.Palette,
   fields: [
    {
     column: 'design',
     editor: EditorType.SavedDesign,
     emote: EmoteName.Message,
     arity: FieldArity.Single,
     label: (t: GiveawaysTranslator) => t.templates.fields.design(),
     description: (t: GiveawaysTranslator) =>
      t.templates.descriptions.design({ list: placeholderDoc }),
     ...savedDesignField(
      'giveawayTemplate',
      { embed: 'embed', components: 'components' },
      designReserve,
     ),
    },
    {
     column: 'banner',
     editor: EditorType.String,
     transform: urlTransform,
     label: (t: GiveawaysTranslator) => t.templates.fields.banner(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.banner(),
    },
    {
     column: 'thumbnail',
     editor: EditorType.String,
     transform: urlTransform,
     label: (t: GiveawaysTranslator) => t.templates.fields.thumbnail(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.thumbnail(),
    },
    {
     column: 'accentColor',
     editor: EditorType.String,
     transform: colorTransform,
     label: (t: GiveawaysTranslator) => t.templates.fields.accentColor(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.accentColor(),
    },
   ],
  },
  {
   id: GiveawayTemplateGroup.Recurring,
   label: (t: GiveawaysTranslator) => t.templates.groups.recurring(),
   emote: EmoteName.Refresh,
   fields: [
    {
     column: 'repeatSeconds',
     editor: EditorType.Duration,
     transform: repeatTransform,
     label: (t: GiveawaysTranslator) => t.templates.fields.repeatSeconds(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.repeatSeconds(),
    },
    {
     column: 'nextRun',
     editor: EditorType.Duration,
     virtual: nextRunVirtual,
     label: (t: GiveawaysTranslator) => t.templates.fields.nextRun(),
     description: (t: GiveawaysTranslator) => t.templates.descriptions.nextRun(),
    },
   ],
  },
 ],
} satisfies SettingsSchemaDef<Row, GiveawaysTranslator>;

export default templateSchema;
