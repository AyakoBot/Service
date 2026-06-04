import { CheckboxBuilder, LabelBuilder, RadioGroupBuilder, TextInputBuilder } from '@discordjs/builders';
import { TextInputStyle } from 'discord-api-types/v10';

import { FieldArity } from '../SettingsSchema.js';
import type { SettingsField } from '../SettingsSchema.js';

import { ComponentKind, resolveComponentKind } from './resolveComponentKind.js';

const asOptions = (field: SettingsField): { label: string; value: string }[] =>
 (Array.isArray(field.options) ? field.options : []);

export const renderField = (field: SettingsField, row: Record<string, unknown>): LabelBuilder => {
 const value = row[field.column];
 const optionCount = Array.isArray(field.options) ? field.options.length : 0;
 const kind = resolveComponentKind(field.editor, field.arity ?? FieldArity.Single, optionCount);
 const customId = field.column;

 const label = new LabelBuilder().setLabel(field.label);
 if (field.description) label.setDescription(field.description);

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
  case ComponentKind.Text:
   return label.setTextInputComponent(
    new TextInputBuilder()
     .setCustomId(customId)
     .setStyle(TextInputStyle.Short)
     .setRequired(Boolean(field.required))
     .setValue(value === undefined || value === null ? '' : String(value)),
   );
  default:
   throw new Error(
    `[settings] unsupported editor render kind '${kind}' for column '${field.column}'`,
   );
 }
};
