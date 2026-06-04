import { ModalBuilder } from '@discordjs/builders';

import type { SettingsGroup, SettingsSchema } from '../SettingsSchema.js';

import { encodeSettingsId, SettingsAction } from './customId.js';
import { renderField } from './renderField.js';

export const buildGroupModal = (
 settingName: string,
 _schema: SettingsSchema,
 group: SettingsGroup,
 rowId: string,
 row: Record<string, unknown>,
): ModalBuilder => {
 const modal = new ModalBuilder()
  .setCustomId(
   encodeSettingsId({ action: SettingsAction.Save, settingName, rowId, groupId: group.id }),
  )
  .setTitle(group.label);

 group.fields
  .filter((field) => (field.showIf ? field.showIf(row).ok : true))
  .slice(0, 5)
  .forEach((field) => modal.addLabelComponents(renderField(field, row)));

 return modal;
};
