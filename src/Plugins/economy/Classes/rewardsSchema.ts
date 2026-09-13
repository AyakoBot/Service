import { EmoteName } from '../../../Classes/EmoteName.js';
import { EditorType } from '../../settings/EditorType.js';
import { FieldArity, type SettingsSchemaDef } from '../../settings/SettingsSchema.js';
import type { EconomyTranslator } from '../Plugin.js';

import type { EconomyRewardRow } from './EconomyRewards.js';
import { EconomyGroups } from './Enums.js';

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
    {
     column: 'currency',
     editor: EditorType.Number,
     emote: EmoteName.Gift,
     label: (t: EconomyTranslator) => t.settings.rewards.fields.currency(),
     description: (t: EconomyTranslator) => t.settings.rewards.descriptions.currency(),
    },
   ],
  },
 ],
} satisfies SettingsSchemaDef<EconomyRewardRow, EconomyTranslator> as unknown as SettingsSchemaDef;
