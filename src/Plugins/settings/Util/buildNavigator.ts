import {
 ButtonBuilder,
 ContainerBuilder,
 SectionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle } from 'discord-api-types/v10';

import type { SettingsSchema } from '../SettingsSchema.js';

import { encodeSettingsId, SettingsAction } from './customId.js';

export const buildNavigator = (
 settingName: string,
 schema: SettingsSchema,
 rowId: string,
 row: Record<string, unknown>,
): ContainerBuilder => {
 const container = new ContainerBuilder().addTextDisplayComponents(
  new TextDisplayBuilder().setContent(`## ${schema.rowLabel(row)}`),
 );

 schema.groups.forEach((group) => {
  const visible = group.showIf ? group.showIf(row) : { ok: true };
  container.addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      visible.ok ? `**${group.label}**` : `**${group.label}**\n-# ${visible.reason ?? ''}`,
     ),
    )
    .setButtonAccessory(
     new ButtonBuilder()
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Edit')
      .setDisabled(!visible.ok)
      .setCustomId(
       encodeSettingsId({ action: SettingsAction.Group, settingName, rowId, groupId: group.id }),
      ),
    ),
  );
 });

 return container;
};
