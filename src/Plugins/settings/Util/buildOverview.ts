import {
 ActionRowBuilder,
 ButtonBuilder,
 StringSelectMenuBuilder,
 ContainerBuilder,
 SectionBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle, type APIPartialEmoji } from 'discord-api-types/v10';

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import type { SettingsSchema } from '../SettingsSchema.js';

import { encodeSettingsId, SettingsAction } from './customId.js';
import { buttonEmoji } from './settingsEmotes.js';

const overviewRowLimit = 7;
const selectLimit = 25;

export interface OverviewOptions {
 title: string;
 description?: string;
 createLabel: string;
 editLabel: string;
 emptyText: string;
 pageLabel: (current: string, total: string) => string;
 activateLabel: string;
 settingName: string;
 schema: SettingsSchema;
 rows: Record<string, unknown>[];
 page: number;
 emotes: EmoteSet;
}

export const buildOverview = ({
 title,
 description,
 createLabel,
 editLabel,
 emptyText,
 pageLabel,
 activateLabel,
 settingName,
 schema,
 rows,
 page,
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
  const pages = Math.max(1, Math.ceil(rows.length / overviewRowLimit));
  const current = Math.min(Math.max(0, page), pages - 1);

  rows.slice(current * overviewRowLimit, (current + 1) * overviewRowLimit).forEach((row) => {
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

  const toggleColumn = schema.groups
   .flatMap((g) => g.fields)
   .find((field) => field.headerToggle)?.column;

  const inactive = toggleColumn ? rows.filter((row) => !row[toggleColumn]) : [];

  if (toggleColumn && inactive.length) {
   container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
     new StringSelectMenuBuilder()
      .setCustomId(
       encodeSettingsId({ action: SettingsAction.ActivateSelected, settingName, page: current }),
      )
      .setPlaceholder(activateLabel)
      .setMinValues(1)
      .setMaxValues(Math.min(inactive.length, selectLimit))
      .setOptions(
       inactive.slice(0, selectLimit).map((row) => ({
        label: schema.rowLabel(row).slice(0, 100),
        value: String(row[schema.rowKey]),
       })),
      ),
    ),
   );
  }

  if (pages > 1) {
   container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${pageLabel(String(current + 1), String(pages))}`),
   );

   const pageButton = (target: number, emoji: APIPartialEmoji, disabled: boolean): ButtonBuilder =>
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setEmoji(buttonEmoji(emoji))
     .setDisabled(disabled)
     .setCustomId(
      encodeSettingsId({ action: SettingsAction.OverviewPage, settingName, page: target }),
     );

   container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
     pageButton(current - 1, emotes.prev, current === 0),
     pageButton(current + 1, emotes.next, current >= pages - 1),
    ),
   );
  }
 }

 return container;
};
