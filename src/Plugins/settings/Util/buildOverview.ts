import {
 ButtonBuilder,
 ContainerBuilder,
 SectionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle } from 'discord-api-types/v10';

import emotes from '../../../Classes/Emotes.js';
import type { SettingsSchema } from '../SettingsSchema.js';

import { encodeSettingsId, SettingsAction } from './customId.js';
import { buttonEmoji } from './settingsEmotes.js';

export const buildOverview = (
 title: string,
 createLabel: string,
 editLabel: string,
 emptyText: string,
 settingName: string,
 schema: SettingsSchema,
 rows: Record<string, unknown>[],
): ContainerBuilder => {
 const container = new ContainerBuilder().addSectionComponents(
  new SectionBuilder()
   .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${title}`))
   .setButtonAccessory(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Success)
     .setLabel(createLabel)
     .setEmoji(buttonEmoji(emotes.plusBG))
     .setCustomId(encodeSettingsId({ action: SettingsAction.Create, settingName })),
   ),
 );

 if (rows.length === 0) {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(emptyText));
 } else {
  rows.slice(0, 20).forEach((row) => {
   container.addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(schema.rowLabel(row)))
     .setButtonAccessory(
      new ButtonBuilder()
       .setStyle(ButtonStyle.Secondary)
       .setLabel(editLabel)
       .setEmoji(buttonEmoji(emotes.edit))
       .setCustomId(
        encodeSettingsId({
         action: SettingsAction.Nav,
         settingName,
         rowId: String(row[schema.rowKey]),
        }),
       ),
     ),
   );
  });

  if (rows.length > 20) {
   container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${rows.length - 20} more not shown`),
   );
  }
 }

 return container;
};
