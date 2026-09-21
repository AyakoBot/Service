import { PayoutCurve, ShopButtonStyle, ShopSurface, type EconomyRoleReward } from '@ayako/database';

import { createCrossAdvert } from '../../../Util/crossAdvert.js';
import { SavedSource, savedRefTransform } from '../../../Util/savedRef.js';
import en from '../Language/en-GB.json' with { type: 'json' };
import { PluginBotKey } from '../../../Util/pluginBotKey.js';
import { PluginName } from '../../../Classes/abstracts/Plugin.js';
import { ComponentBuilderCommand } from '../../componentBuilder/Classes/Commands.js';
import { EmbedBuilderCommand } from '../../embedBuilder/Classes/Commands.js';

import { EmoteName } from '../../../Classes/EmoteName.js';
import { EditorType } from '../../settings/EditorType.js';
import {
 FieldArity,
 type OptionsResolver,
 type SettingsFieldVirtual,
 type SettingsSchemaDef,
 type ShowIfResult,
} from '../../settings/SettingsSchema.js';
import type EconomyPlugin from '../Plugin.js';
import type { EconomyTranslator } from '../Plugin.js';

import type { EconomyRewardRow } from './EconomyRewards.js';
import { EconomyGroups } from './Enums.js';
import { EconomyRoute } from './Routes.js';

const wantsPanel = (row: EconomyRewardRow): ShowIfResult => ({
 ok: row.shopType === ShopSurface.panel,
});

const panelPost: SettingsFieldVirtual<EconomyRewardRow> = {
 read: async () => null,
 write: async (value, row, ctx) => {
  const channelId = Array.isArray(value) ? value[0] : value;
  if (!channelId) return { ok: true };

  return (ctx.plugin as EconomyPlugin).shopPanel.post(
   row as unknown as EconomyRoleReward,
   String(channelId),
  );
 },
};

const shopFooter = (t: EconomyTranslator, row: EconomyRewardRow): string =>
 t.settings.rewards.shopFooter({
  command: row.panelEmbed
   ? `/${EmbedBuilderCommand.EmbedBuilder}`
   : `/${ComponentBuilderCommand.ComponentBuilder}`,
 });

const customRoleAdvert = createCrossAdvert<EconomyRewardRow>({
 partner: PluginName.CustomRoles,
 partnerKey: PluginBotKey.CustomRoles,
 advert: async (plugin, _stored, invite) =>
  (await (plugin as EconomyPlugin).t(undefined)).settings.rewards.crossAds.customRolesMissing({
   invite,
  }),
 unavailable: async (plugin, invite) =>
  (await (plugin as EconomyPlugin).t(undefined)).settings.rewards.crossAds.customRolesMissing({
   invite,
  }),
 read: async (row) => row.customRoleReward,
 write: async (value, row, ctx) => {
  const picked = Array.isArray(value) ? value[0] : value;

  await ctx.client.db.client.economyRoleReward.updateMany({
   where: { id: row.id, guild: row.guild },
   data: { customRoleReward: picked ? String(picked) : null },
  });

  return { ok: true };
 },
});

const customRoleOptions: OptionsResolver = async (ctx) => {
 const rows = await ctx.client.db.client.roleReward.findMany({
  where: { guild: ctx.guildId, customRole: true, active: true },
 });

 return rows.map((row) => ({ label: `Reward ${row.id}`, value: row.id }));
};

const recurring = (row: EconomyRewardRow): ShowIfResult => ({ ok: row.payEvery > 0 });

export default {
 table: 'economyRoleReward',
 rowKey: 'id',
 multiRow: true,
 title: (t: EconomyTranslator) => t.settings.rewards.configTitle(),
 overviewDescription: (t: EconomyTranslator) => t.settings.rewards.overviewDescription(),
 rowLabel: (t: EconomyTranslator, row: EconomyRewardRow) =>
  t.settings.rewards.rowLabel({ id: row.id }),
 rowSummary: (t: EconomyTranslator, row: EconomyRewardRow) => {
  const roleId = row.purchaseRoles[0] ?? row.roles[0];
  const role = roleId ? `<@&${roleId}>` : t.settings.rewards.rowNoRole();

  return row.buyPrice > 0
   ? t.settings.rewards.rowSummary({ role, price: String(row.buyPrice) })
   : t.settings.rewards.rowSummaryFree({ role });
 },
 groups: [
  {
   id: EconomyGroups.Shop,
   label: (t: EconomyTranslator) => t.settings.groups.shop(),
   description: (t: EconomyTranslator) => t.settings.rewards.shopSection(),
   emote: EmoteName.Shop,
   fields: [
    {
     column: 'buyPrice',
     editor: EditorType.Number,
     emote: EmoteName.Coin,
     arity: FieldArity.Single,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.buyPrice(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.buyPrice(),
    },
    {
     column: 'purchaseRoles',
     editor: EditorType.Roles,
     emote: EmoteName.Role,
     arity: FieldArity.Multi,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.purchaseRoles(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.purchaseRoles(),
    },
    {
     column: 'customRoleReward',
     editor: EditorType.SettingLink,
     emote: EmoteName.Palette,
     arity: FieldArity.Single,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.customRoleReward(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.customRoleReward(),
     options: customRoleOptions,
     virtual: customRoleAdvert,
    },
    {
     column: 'shopType',
     editor: EditorType.ShopType,
     emote: EmoteName.Shop,
     arity: FieldArity.Single,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.shopType(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.shopType(),
     options: [
      {
       value: ShopSurface.command,
       label: (t: EconomyTranslator) => t.settings.rewards.options.shopCommand(),
      },
      {
       value: ShopSurface.panel,
       label: (t: EconomyTranslator) => t.settings.rewards.options.shopPanel(),
      },
     ],
    },
   ],
  },
  {
   id: EconomyGroups.Panel,
   label: (t: EconomyTranslator) => t.settings.groups.panel(),
   description: (t: EconomyTranslator) => t.settings.rewards.panelSection(),
   emote: EmoteName.Message,
   footer: shopFooter,
   fields: [
    {
     column: 'panelButtonText',
     editor: EditorType.String,
     emote: EmoteName.Heading,
     showIf: wantsPanel,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.panelButtonText(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.panelButtonText(),
    },
    {
     column: 'panelButtonEmote',
     editor: EditorType.Emote,
     emote: EmoteName.Emoji,
     showIf: wantsPanel,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.panelButtonEmote(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.panelButtonEmote(),
    },
    {
     column: 'panelButtonStyle',
     editor: EditorType.ButtonStyle,
     emote: EmoteName.Palette,
     arity: FieldArity.Single,
     showIf: wantsPanel,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.panelButtonStyle(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.panelButtonStyle(),
     options: [
      {
       value: ShopButtonStyle.primary,
       label: (t: EconomyTranslator) => t.settings.rewards.options.stylePrimary(),
      },
      {
       value: ShopButtonStyle.secondary,
       label: (t: EconomyTranslator) => t.settings.rewards.options.styleSecondary(),
      },
      {
       value: ShopButtonStyle.success,
       label: (t: EconomyTranslator) => t.settings.rewards.options.styleSuccess(),
      },
      {
       value: ShopButtonStyle.danger,
       label: (t: EconomyTranslator) => t.settings.rewards.options.styleDanger(),
      },
     ],
    },
    {
     column: 'panelEmbed',
     editor: EditorType.String,
     emote: EmoteName.Message,
     arity: FieldArity.Single,
     showIf: wantsPanel,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.panelEmbed(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.panelEmbed(),
     transform: savedRefTransform(
      SavedSource.Embed,
      'economyRoleReward',
      { panelComponents: null },
      en.errors.embedNotFound,
     ),
    },
    {
     column: 'panelComponents',
     editor: EditorType.String,
     emote: EmoteName.Json,
     arity: FieldArity.Single,
     showIf: wantsPanel,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.panelComponents(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.panelComponents(),
     transform: savedRefTransform(
      SavedSource.Components,
      'economyRoleReward',
      { panelEmbed: null },
      en.errors.componentsNotFound,
     ),
    },
    {
     column: 'panelChannel',
     editor: EditorType.Channel,
     emote: EmoteName.ChannelText,
     arity: FieldArity.Single,
     showIf: wantsPanel,
     virtual: panelPost,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.panelChannel(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.panelChannel(),
    },
   ],
  },
  {
   id: EconomyGroups.Payout,
   label: (t: EconomyTranslator) => t.settings.groups.payout(),
   description: (t: EconomyTranslator) => t.settings.rewards.payoutSection(),
   emote: EmoteName.Coin,
   fields: [
    {
     column: 'currency',
     editor: EditorType.Number,
     emote: EmoteName.Gift,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.currency(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.currency(),
    },
    // TODO: move to levelling role rewards once levelling is migrated
    {
     column: 'xpMultiplier',
     editor: EditorType.Number,
     emote: EmoteName.Xp,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.xpMultiplier(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.xpMultiplier(),
    },
    {
     column: 'payEvery',
     editor: EditorType.Number,
     emote: EmoteName.Timer,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.payEvery(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.payEvery(),
    },
   ],
  },
  {
   id: EconomyGroups.Recurring,
   label: (t: EconomyTranslator) => t.settings.groups.recurring(),
   description: (t: EconomyTranslator) => t.settings.rewards.recurringSection(),
   emote: EmoteName.Curve,
   fields: [
    {
     column: 'repeating',
     editor: EditorType.Boolean,
     showIf: recurring,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.repeating(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.repeating(),
    },
    {
     column: 'recurringAmount',
     editor: EditorType.Number,
     emote: EmoteName.Coin,
     showIf: recurring,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.recurringAmount(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.recurringAmount(),
    },
    {
     column: 'curve',
     editor: EditorType.FormulaType,
     emote: EmoteName.Brain,
     arity: FieldArity.Single,
     separator: true,
     showIf: recurring,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.curve(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.curve(),
     options: Object.values(PayoutCurve).map((value) => ({
      value,
      label: (t: EconomyTranslator) => t.settings.rewards.curves[value](),
     })),
    },
    {
     column: 'curveModifier',
     editor: EditorType.Number,
     emote: EmoteName.Curve,
     showIf: recurring,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.curveModifier(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.curveModifier(),
    },
   ],
   actions: [
    {
     customId: EconomyRoute.CurvePreview,
     label: (t: EconomyTranslator) => t.settings.rewards.previewAction(),
     description: (t: EconomyTranslator) => t.settings.rewards.previewDescription(),
     buttonLabel: (t: EconomyTranslator) => t.settings.rewards.previewButton(),
     emote: EmoteName.Curve,
    },
   ],
  },
  {
   id: EconomyGroups.Rewards,
   label: (t: EconomyTranslator) => t.settings.groups.rewards(),
   description: (t: EconomyTranslator) => t.settings.rewards.section(),
   emote: EmoteName.Badge,
   fields: [
    {
     column: 'active',
     editor: EditorType.Boolean,
     label: (t: EconomyTranslator) => t.base.t.Active(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.active(),
     headerToggle: true,
    },
    {
     column: 'roles',
     editor: EditorType.Roles,
     emote: EmoteName.Role,
     arity: FieldArity.Multi,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.roles(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.roles(),
    },
    {
     column: 'denyRoles',
     editor: EditorType.Roles,
     emote: EmoteName.DenyRole,
     arity: FieldArity.Multi,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.denyRoles(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.denyRoles(),
    },
    {
     column: 'denyUsers',
     editor: EditorType.Users,
     emote: EmoteName.DenyUser,
     arity: FieldArity.Multi,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.denyUsers(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.denyUsers(),
    },
   ],
  },
 ],
} satisfies SettingsSchemaDef<EconomyRewardRow, EconomyTranslator> as unknown as SettingsSchemaDef;
