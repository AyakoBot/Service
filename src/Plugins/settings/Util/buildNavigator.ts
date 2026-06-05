import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SectionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle } from 'discord-api-types/v10';

import type { SettingsSchema } from '../SettingsSchema.js';

import { encodeSettingsId, SettingsAction } from './customId.js';

export interface NavigatorChrome {
 back: string;
 pause: string;
 resume: string;
 del: string;
 incomplete: string;
}

const isUnset = (value: unknown): boolean =>
 value === undefined ||
 value === null ||
 value === '' ||
 (Array.isArray(value) && value.length === 0);

export const buildNavigator = (
 settingName: string,
 schema: SettingsSchema,
 rowId: string,
 row: Record<string, unknown>,
 chrome: NavigatorChrome,
): ContainerBuilder => {
 const container = new ContainerBuilder().addTextDisplayComponents(
  new TextDisplayBuilder().setContent(`## ${schema.rowLabel(row)}`),
 );

 schema.groups.forEach((group) => {
  const visible = group.showIf ? group.showIf(row) : { ok: true };
  const incomplete = group.fields.some((f) => f.required && isUnset(row[f.column]));
  const label = incomplete ? `**${group.label}** ${chrome.incomplete}` : `**${group.label}**`;

  container.addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(
      visible.ok ? label : `${label}\n-# ${visible.reason ?? ''}`,
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

 container.addActionRowComponents(
  new ActionRowBuilder<ButtonBuilder>().addComponents(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel(chrome.back)
    .setCustomId(encodeSettingsId({ action: SettingsAction.Nav, settingName })),
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel(row.active ? chrome.pause : chrome.resume)
    .setCustomId(encodeSettingsId({ action: SettingsAction.Pause, settingName, rowId })),
   new ButtonBuilder()
    .setStyle(ButtonStyle.Danger)
    .setLabel(chrome.del)
    .setCustomId(encodeSettingsId({ action: SettingsAction.Delete, settingName, rowId })),
  ),
 );

 return container;
};
