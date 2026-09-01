import {
 CheckboxBuilder,
 CheckboxGroupBuilder,
 LabelBuilder,
 MentionableSelectMenuBuilder,
 RadioGroupBuilder,
 RoleSelectMenuBuilder,
 StringSelectMenuBuilder,
 TextInputBuilder,
 UserSelectMenuBuilder,
} from '@discordjs/builders';
import { TextInputStyle } from 'discord-api-types/v10';

import { formatDurationSeconds } from '../../../Util/durationSeconds.js';
import formatDuration from '../../../Util/formatDuration.js';
import { EditorType } from '../EditorType.js';
import { FieldArity } from '../SettingsSchema.js';
import type { SettingsField } from '../SettingsSchema.js';

import { asOptions, buildEntitySelect } from './fieldValueHelpers.js';
import { ComponentKind, resolveComponentKind } from './resolveComponentKind.js';

const labelDescLimit = 100;

export const clampDescription = (description: string): string => {
 if (description.length <= labelDescLimit) return description;
 return `${description.slice(0, labelDescLimit - 1)}…`;
};

const renderEntity = (field: SettingsField, value: unknown, customId: string): LabelBuilder => {
 const label = new LabelBuilder().setLabel(field.label);
 if (field.description) label.setDescription(clampDescription(field.description));

 const select = buildEntitySelect(field, value, customId);
 if (select instanceof RoleSelectMenuBuilder) return label.setRoleSelectMenuComponent(select);
 if (select instanceof UserSelectMenuBuilder) return label.setUserSelectMenuComponent(select);
 if (select instanceof MentionableSelectMenuBuilder) {
  return label.setMentionableSelectMenuComponent(select);
 }
 return label.setChannelSelectMenuComponent(select);
};

export const renderField = (field: SettingsField, row: Record<string, unknown>): LabelBuilder => {
 const value = row[field.column];
 const optionCount = Array.isArray(field.options) ? field.options.length : 0;
 const kind = resolveComponentKind(field.editor, field.arity ?? FieldArity.Single, optionCount);
 const customId = field.column;

 const label = new LabelBuilder().setLabel(field.label);
 if (field.description) label.setDescription(clampDescription(field.description));

 switch (kind) {
  case ComponentKind.CheckboxBool:
   return label.setCheckboxComponent(
    new CheckboxBuilder().setCustomId(customId).setDefault(Boolean(value)),
   );
  case ComponentKind.Radio:
   return label.setRadioGroupComponent(
    new RadioGroupBuilder()
     .setCustomId(customId)
     .setOptions(asOptions(field).map((o) => ({ ...o, default: o.value === String(value) }))),
   );
  case ComponentKind.Entity:
   return renderEntity(field, value, customId);
  case ComponentKind.TextMulti:
   return label.setTextInputComponent(
    new TextInputBuilder()
     .setCustomId(customId)
     .setStyle(TextInputStyle.Paragraph)
     .setRequired(Boolean(field.required))
     .setValue(Array.isArray(value) ? value.join('\n') : ''),
   );
  case ComponentKind.Text: {
   const input = new TextInputBuilder()
    .setCustomId(customId)
    .setStyle(field.multiline ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(Boolean(field.required));

   if (field.editor === EditorType.Duration) {
    input
     .setPlaceholder('e.g. 30m, 2h, 1h 30m')
     .setValue(
      field.ms ? formatDuration(Number(value)) : formatDurationSeconds(Number(value)),
     );
   } else {
    input.setValue(value === undefined || value === null ? '' : String(value));
   }

   return label.setTextInputComponent(input);
  }
  case ComponentKind.SecretText:
   return label.setTextInputComponent(
    new TextInputBuilder()
     .setCustomId(customId)
     .setStyle(TextInputStyle.Short)
     .setRequired(false)
     .setPlaceholder('Leave blank to keep current')
     .setValue(''),
   );
  case ComponentKind.CheckboxGroup:
   return label.setCheckboxGroupComponent(
    new CheckboxGroupBuilder().setCustomId(customId).setOptions(
     asOptions(field).map((o) => ({
      ...o,
      default: Array.isArray(value) && value.includes(o.value),
     })),
    ),
   );
  case ComponentKind.Select1:
   return label.setStringSelectMenuComponent(
    new StringSelectMenuBuilder()
     .setCustomId(customId)
     .setMinValues(0)
     .setMaxValues(1)
     .setOptions(asOptions(field).map((o) => ({ ...o, default: String(value) === o.value }))),
   );
  case ComponentKind.SelectN:
   return label.setStringSelectMenuComponent(
    new StringSelectMenuBuilder()
     .setCustomId(customId)
     .setMinValues(0)
     .setMaxValues(Math.max(1, asOptions(field).length))
     .setOptions(
      asOptions(field).map((o) => ({
       ...o,
       default: Array.isArray(value) && value.includes(o.value),
      })),
     ),
   );
  default:
   throw new Error(
    `[settings] unsupported editor render kind '${kind}' for column '${field.column}'`,
   );
 }
};
