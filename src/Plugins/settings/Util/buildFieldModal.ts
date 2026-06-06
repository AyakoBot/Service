import { ModalBuilder } from '@discordjs/builders';

import type { SettingsField } from '../SettingsSchema.js';

import { encodeSettingsId, SettingsAction } from './customId.js';
import { renderField } from './renderField.js';

export const buildFieldModal = (
 settingName: string,
 rowId: string,
 groupId: string,
 field: SettingsField,
 row: Record<string, unknown>,
 hideUnavail: boolean,
): ModalBuilder =>
 new ModalBuilder()
  .setCustomId(
   encodeSettingsId({
    action: SettingsAction.FieldSave,
    settingName,
    rowId,
    groupId,
    column: field.column,
    hideUnavail,
   }),
  )
  .setTitle(field.label)
  .addLabelComponents(renderField(field, row));
