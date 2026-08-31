import {
 ButtonBuilder,
 ContainerBuilder,
 SectionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle } from 'discord-api-types/v10';

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import type { SettingsSchema } from '../SettingsSchema.js';

import { encodeSettingsId, SettingsAction } from './customId.js';
import { buttonEmoji } from './settingsEmotes.js';

const overviewRowLimit = 8;

export interface OverviewOptions {
 title: string;
 description?: string;
 createLabel: string;
 editLabel: string;
 emptyText: string;
 overflowText: (count: string) => string;
 settingName: string;
 schema: SettingsSchema;
 rows: Record<string, unknown>[];
 emotes: EmoteSet;
}

export const buildOverview = ({
 title,
 description,
 createLabel,
 editLabel,
 emptyText,
 overflowText,
 settingName,
 schema,
 rows,
 emotes,
}: OverviewOptions): ContainerBuilder => {
 const container = new ContainerBuilder().addSectionComponents(
  new SectionBuilder()
   .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
   .setButtonAccessory(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Success)
     .setLabel(createLabel)
     .setEmoji(buttonEmoji(emotes.plus))
     .setCustomId(encodeSettingsId({ action: SettingsAction.Create, settingName })),
   ),
 );

 if (description) {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
 }

 if (rows.length === 0) {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(emptyText));
 } else {
  rows.slice(0, overviewRowLimit).forEach((row) => {
   const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(schema.rowLabel(row)),
   );

   const summary = schema.rowSummary?.(row);
   if (summary) {
    section.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${summary}`));
   }

   section.setButtonAccessory(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setLabel(editLabel)
     .setEmoji(buttonEmoji(emotes.edit))
     .setCustomId(
      encodeSettingsId({
       action: SettingsAction.Nav,
       settingName,
       rowId: String(row[schema.rowKey]),
       hideUnavail: true,
      }),
     ),
   );

   container.addSectionComponents(section);
  });

  if (rows.length > overviewRowLimit) {
   container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     `-# ${overflowText(String(rows.length - overviewRowLimit))}`,
    ),
   );
  }
 }

 return container;
};
