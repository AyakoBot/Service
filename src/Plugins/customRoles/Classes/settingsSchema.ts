import { ActivitySource, type RoleReward } from '@ayako/database';
import { ChannelType } from 'discord-api-types/v10';

import { EmoteName } from '../../../Classes/EmoteName.js';
import { EditorType } from '../../settings/EditorType.js';
import {
 FieldArity,
 type SettingsSchemaDef,
 type ShowIfResult,
 type TransformContext,
} from '../../settings/SettingsSchema.js';
import { minInactivitySeconds } from '../constants.js';
import en from '../Language/en-GB.json' with { type: 'json' };
import type CustomRolesPlugin from '../Plugin.js';
import type { CustomRolesTranslator } from '../Plugin.js';

export enum CustomRolesGroup {
 Reward = 'reward',
 CustomRole = 'customrole',
 Inactivity = 'inactivity',
}

export const MAX_SHARE_LIMIT = 25;

const notifyChannelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

const wantsCustomRole = (row: RoleReward): ShowIfResult => ({ ok: row.customRole });

const atLeastADay = (value: unknown): ShowIfResult =>
 Number(value) >= minInactivitySeconds
  ? { ok: true }
  : { ok: false, reason: en.settings.inactivity.errors.tooShort };

const shareCount = (value: unknown): ShowIfResult => {
 if (value === null || value === undefined || value === '') return { ok: true };

 const parsed = Number(value);

 return Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_SHARE_LIMIT
  ? { ok: true }
  : { ok: false, reason: `Enter a whole number between 0 and ${MAX_SHARE_LIMIT}.` };
};

export default {
 table: 'roleReward',
 rowKey: 'id',
 multiRow: true,
 title: (t: CustomRolesTranslator) => t.settings.configTitle(),
 overviewDescription: (t: CustomRolesTranslator) => t.settings.overviewDescription(),
 rowLabel: (t: CustomRolesTranslator, row: RoleReward) => t.settings.rowLabel({ id: row.id }),
 rowSummary: (t: CustomRolesTranslator, row: RoleReward) =>
  t.settings.rowSummary({ count: String(row.roles.length) }),
 onChange: async (ctx: TransformContext) => {
  const plugin = ctx.plugin as CustomRolesPlugin;

  await plugin.activity.syncTracking(ctx.guildId, ctx.rowId);
  await plugin.rewards.enqueueReconcile(ctx.guildId);
 },
 groups: [
  {
   id: CustomRolesGroup.Reward,
   label: (t: CustomRolesTranslator) => t.settings.groups.reward(),
   description: (t: CustomRolesTranslator) => t.settings.sections.reward(),
   emote: EmoteName.Badge,
   fields: [
    {
     column: 'active',
     editor: EditorType.Boolean,
     label: (t: CustomRolesTranslator) => t.base.t.Active(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.active(),
     headerToggle: true,
    },
    {
     column: 'roles',
     editor: EditorType.Roles,
     emote: EmoteName.Role,
     arity: FieldArity.Multi,
     label: (t: CustomRolesTranslator) => t.settings.fields.roles(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.roles(),
    },
    {
     column: 'denyRoles',
     editor: EditorType.Roles,
     emote: EmoteName.DenyRole,
     arity: FieldArity.Multi,
     label: (t: CustomRolesTranslator) => t.settings.fields.denyRoles(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.denyRoles(),
    },
    {
     column: 'denyUsers',
     editor: EditorType.Users,
     emote: EmoteName.DenyUser,
     arity: FieldArity.Multi,
     label: (t: CustomRolesTranslator) => t.settings.fields.denyUsers(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.denyUsers(),
    },
    {
     column: 'notifyChannel',
     editor: EditorType.Channel,
     emote: EmoteName.Bell,
     arity: FieldArity.Single,
     channelTypes: notifyChannelTypes,
     label: (t: CustomRolesTranslator) => t.settings.fields.notifyChannel(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.notifyChannel(),
    },
   ],
  },
  {
   id: CustomRolesGroup.CustomRole,
   label: (t: CustomRolesTranslator) => t.settings.groups.customRole(),
   description: (t: CustomRolesTranslator) => t.settings.sections.customRole(),
   emote: EmoteName.Palette,
   fields: [
    {
     column: 'customRole',
     editor: EditorType.Boolean,
     label: (t: CustomRolesTranslator) => t.settings.fields.customRole(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.customRole(),
    },
    {
     column: 'canSetColor',
     editor: EditorType.Boolean,
     label: (t: CustomRolesTranslator) => t.settings.fields.canSetColor(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.canSetColor(),
     showIf: wantsCustomRole,
    },
    {
     column: 'canSetIcon',
     editor: EditorType.Boolean,
     label: (t: CustomRolesTranslator) => t.settings.fields.canSetIcon(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.canSetIcon(),
     showIf: wantsCustomRole,
    },
    {
     column: 'canSetGradient',
     editor: EditorType.Boolean,
     label: (t: CustomRolesTranslator) => t.settings.fields.canSetGradient(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.canSetGradient(),
     showIf: wantsCustomRole,
    },
    {
     column: 'canSetHolo',
     editor: EditorType.Boolean,
     label: (t: CustomRolesTranslator) => t.settings.fields.canSetHolo(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.canSetHolo(),
     showIf: wantsCustomRole,
    },
    {
     column: 'positionRole',
     editor: EditorType.Role,
     emote: EmoteName.Anchor,
     arity: FieldArity.Single,
     label: (t: CustomRolesTranslator) => t.settings.fields.positionRole(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.positionRole(),
     showIf: wantsCustomRole,
    },
    {
     column: 'maxShare',
     editor: EditorType.Number,
     emote: EmoteName.Share,
     label: (t: CustomRolesTranslator) => t.settings.fields.maxShare(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.maxShare(),
     showIf: wantsCustomRole,
     validate: shareCount,
    },
   ],
  },
  {
   id: CustomRolesGroup.Inactivity,
   label: (t: CustomRolesTranslator) => t.settings.groups.inactivity(),
   description: (t: CustomRolesTranslator) => t.settings.sections.inactivity(),
   emote: EmoteName.Timer,
   fields: [
    {
     column: 'inactivityWipe',
     editor: EditorType.Boolean,
     label: (t: CustomRolesTranslator) => t.settings.inactivity.fields.inactivityWipe(),
     description: (t: CustomRolesTranslator) =>
      t.settings.inactivity.descriptions.inactivityWipe(),
    },
    {
     column: 'activitySources',
     editor: EditorType.ActivitySources,
     emote: EmoteName.Activity,
     arity: FieldArity.Multi,
     showIf: wantsCustomRole,
     label: (t: CustomRolesTranslator) => t.settings.inactivity.fields.activitySources(),
     description: (t: CustomRolesTranslator) =>
      t.settings.inactivity.descriptions.activitySources(),
     options: [
      {
       value: ActivitySource.Messages,
       label: (t: CustomRolesTranslator) => t.settings.inactivity.options.messages(),
       description: (t: CustomRolesTranslator) => t.settings.inactivity.options.messagesHint(),
      },
      {
       value: ActivitySource.Reactions,
       label: (t: CustomRolesTranslator) => t.settings.inactivity.options.reactions(),
       description: (t: CustomRolesTranslator) => t.settings.inactivity.options.reactionsHint(),
      },
      {
       value: ActivitySource.Voice,
       label: (t: CustomRolesTranslator) => t.settings.inactivity.options.voice(),
       description: (t: CustomRolesTranslator) => t.settings.inactivity.options.voiceHint(),
      },
      // TODO: request presence intent for this
      // {
       // value: ActivitySource.Online,
       // label: (t: CustomRolesTranslator) => t.settings.inactivity.options.online(),
       // description: (t: CustomRolesTranslator) => t.settings.inactivity.options.onlineHint(),
      // },
     ],
    },
    {
     column: 'inactiveAfter',
     editor: EditorType.Duration,
     emote: EmoteName.Timer,
     showIf: wantsCustomRole,
     label: (t: CustomRolesTranslator) => t.settings.inactivity.fields.inactiveAfter(),
     description: (t: CustomRolesTranslator) =>
      t.settings.inactivity.descriptions.inactiveAfter(),
     validate: atLeastADay,
    },
   ],
  },
 ],
} satisfies SettingsSchemaDef<RoleReward, CustomRolesTranslator> as unknown as SettingsSchemaDef;
