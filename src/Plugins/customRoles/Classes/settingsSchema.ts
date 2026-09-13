import type { RoleReward } from '@ayako/database';
import { ChannelType } from 'discord-api-types/v10';

import { EmoteName } from '../../../Classes/EmoteName.js';
import { EditorType } from '../../settings/EditorType.js';
import {
 FieldArity,
 type SettingsSchemaDef,
 type ShowIfResult,
 type TransformContext,
} from '../../settings/SettingsSchema.js';
import type CustomRolesPlugin from '../Plugin.js';
import type { CustomRolesTranslator } from '../Plugin.js';

export enum CustomRolesGroup {
 Reward = 'reward',
 CustomRole = 'customrole',
}

export const MAX_SHARE_LIMIT = 25;

const notifyChannelTypes = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

const wantsCustomRole = (row: RoleReward): ShowIfResult => ({ ok: row.customRole });

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
 onChange: async (ctx: TransformContext) =>
  (ctx.plugin as CustomRolesPlugin).rewards.enqueueReconcile(ctx.guildId),
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
     arity: FieldArity.Multi,
     label: (t: CustomRolesTranslator) => t.settings.fields.roles(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.roles(),
    },
    {
     column: 'denyRoles',
     editor: EditorType.Roles,
     arity: FieldArity.Multi,
     label: (t: CustomRolesTranslator) => t.settings.fields.denyRoles(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.denyRoles(),
    },
    {
     column: 'denyUsers',
     editor: EditorType.Users,
     arity: FieldArity.Multi,
     label: (t: CustomRolesTranslator) => t.settings.fields.denyUsers(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.denyUsers(),
    },
    {
     column: 'xpMultiplier',
     editor: EditorType.Number,
     label: (t: CustomRolesTranslator) => t.settings.fields.xpMultiplier(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.xpMultiplier(),
    },
    {
     column: 'notifyChannel',
     editor: EditorType.Channel,
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
     arity: FieldArity.Single,
     label: (t: CustomRolesTranslator) => t.settings.fields.positionRole(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.positionRole(),
     showIf: wantsCustomRole,
    },
    {
     column: 'maxShare',
     editor: EditorType.Number,
     label: (t: CustomRolesTranslator) => t.settings.fields.maxShare(),
     description: (t: CustomRolesTranslator) => t.settings.descriptions.maxShare(),
     showIf: wantsCustomRole,
     validate: shareCount,
    },
   ],
  },
 ],
} satisfies SettingsSchemaDef<RoleReward, CustomRolesTranslator> as unknown as SettingsSchemaDef;
