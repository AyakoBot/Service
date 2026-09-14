import { PayoutCurve, ShopButtonStyle, ShopSurface, type EconomyRoleReward } from '@ayako/database';

import { inviteFor, partnerAvailable } from '../../../Util/crossAdvert.js';
import { PluginBotKey } from '../../../Util/pluginBotKey.js';
import { PluginName } from '../../../Classes/abstracts/Plugin.js';
import { ComponentBuilderCommand } from '../../componentBuilder/Classes/Commands.js';

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

const shopFooter = (t: EconomyTranslator): string =>
 t.settings.rewards.shopFooter({ command: `/${ComponentBuilderCommand.ComponentBuilder}` });

const customRoleOptions: OptionsResolver = async (ctx) => {
 const rows = await ctx.client.db.client.roleReward.findMany({
  where: { guild: ctx.guildId, customRole: true },
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
 rowSummary: (t: EconomyTranslator, row: EconomyRewardRow) =>
  t.settings.rewards.rowSummary({ count: String(row.roles.length) }),
 groups: [
  {
   id: EconomyGroups.Shop,
   label: (t: EconomyTranslator) => t.settings.groups.shop(),
   description: (t: EconomyTranslator) => t.settings.rewards.shopSection(),
   emote: EmoteName.Shop,
   footer: shopFooter,
   availableIf: async (_row, ctx) =>
    (await partnerAvailable(
     ctx.client,
     ctx.guildId,
     PluginName.CustomRoles,
     PluginBotKey.CustomRoles,
    ))
     ? { ok: true }
     : {
        ok: false,
        reason: (
         await (ctx.plugin as EconomyPlugin).t(ctx.guildId)
        ).settings.rewards.crossAds.customRolesMissing({
         invite: inviteFor(PluginBotKey.CustomRoles),
        }),
       },
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
    },
    {
     column: 'shopType',
     editor: EditorType.ShopType,
     emote: EmoteName.Shop,
     arity: FieldArity.Single,
     separator: true,
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
    {
     column: 'payEvery',
     editor: EditorType.Number,
     emote: EmoteName.Timer,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.payEvery(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.payEvery(),
    },
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
     separator: true,
     showIf: recurring,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.recurringAmount(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.recurringAmount(),
    },
    {
     column: 'curve',
     editor: EditorType.FormulaType,
     emote: EmoteName.Brain,
     arity: FieldArity.Single,
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
