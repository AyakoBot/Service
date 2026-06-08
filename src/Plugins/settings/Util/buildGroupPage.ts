import {
 ActionRowBuilder,
 ButtonBuilder,
 ContainerBuilder,
 SectionBuilder,
 SeparatorBuilder,
 StringSelectMenuBuilder,
 TextDisplayBuilder,
} from '@discordjs/builders';
import { ButtonStyle } from 'discord-api-types/v10';

import emotes from '../../../Classes/Emotes.js';
import type SettingsPlugin from '../Plugin.js';
import type { SettingsGroup, SettingsSchema } from '../SettingsSchema.js';

import { encodeSettingsId, SettingsAction } from './customId.js';
import { renderInlineField } from './renderInlineField.js';
import { buttonEmoji, textEmote } from './settingsEmotes.js';

type SettingsTranslator = Awaited<ReturnType<SettingsPlugin['t']>>;

export type TopLevelBuilder =
 | SectionBuilder
 | ContainerBuilder
 | TextDisplayBuilder
 | ActionRowBuilder<ButtonBuilder>
 | ActionRowBuilder<StringSelectMenuBuilder>;

export interface BuildGroupPageArgs {
 settingName: string;
 schema: SettingsSchema;
 group: SettingsGroup;
 rowId: string;
 row: Record<string, unknown>;
 hideUnavail: boolean;
 t: SettingsTranslator;
}

const isUnset = (value: unknown): boolean =>
 value === undefined ||
 value === null ||
 value === '' ||
 (Array.isArray(value) && value.length === 0);

const groupHasUnsetRequired = (group: SettingsGroup, row: Record<string, unknown>): boolean =>
 group.fields.some((field) => field.required && isUnset(row[field.column]));

export const buildGroupPage = ({
 settingName,
 schema,
 group,
 rowId,
 row,
 hideUnavail,
 t,
}: BuildGroupPageArgs): TopLevelBuilder[] => {
 const idFor = (action: SettingsAction, groupId?: string, column?: string): string =>
  encodeSettingsId({ action, settingName, rowId, groupId, column, hideUnavail });

 const headerText = `# ${textEmote(emotes.settings)} ${schema.title ?? t.navigator.configTitle()}\n-# ${t.navigator.numberLabel()} #${rowId}`;

 const header: TopLevelBuilder = schema.multiRow
  ? new SectionBuilder()
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
     .setButtonAccessory(
      new ButtonBuilder()
       .setStyle(ButtonStyle.Danger)
       .setEmoji(buttonEmoji(emotes.trash))
       .setLabel(t.base.t.Delete())
       .setCustomId(idFor(SettingsAction.Delete)),
     )
  : new TextDisplayBuilder().setContent(headerText);

 const container = new ContainerBuilder();

 const toggleField = group.fields.find((field) => field.headerToggle);
 const groupHeading = `## ${textEmote(group.emote ?? emotes.settings)} ${group.label}`;

 if (toggleField) {
  const on = Boolean(row[toggleField.column]);
  container.addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(groupHeading))
    .setButtonAccessory(
     new ButtonBuilder()
      .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setLabel(on ? t.navigator.enabled() : t.navigator.disabled())
      .setEmoji(buttonEmoji(on ? emotes.enabled : emotes.disabled))
      .setCustomId(idFor(SettingsAction.ToggleField, group.id, toggleField.column)),
    ),
  );
 } else {
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(groupHeading));
 }

 container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

 group.fields
  .filter((field) => !field.headerToggle)
  .forEach((field) => {
   const visible = field.showIf ? field.showIf(row) : { ok: true };
   if (!visible.ok && hideUnavail) return;

   renderInlineField(
    container,
    field,
    row,
    (action, column) => idFor(action, group.id, column),
    {
     enabled: t.navigator.enabled(),
     disabled: t.navigator.disabled(),
     change: t.navigator.change(),
    },
    visible,
   );
  });

 container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

 container.addSectionComponents(
  new SectionBuilder()
   .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${t.navigator.unavailHint()}`))
   .setButtonAccessory(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setLabel(hideUnavail ? t.navigator.show() : t.navigator.hide())
     .setCustomId(
      encodeSettingsId({
       action: SettingsAction.ToggleUnavail,
       settingName,
       rowId,
       groupId: group.id,
       hideUnavail: !hideUnavail,
      }),
     ),
   ),
 );

 const page: TopLevelBuilder[] = [header, container];

 if (schema.groups.length <= 5) {
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  schema.groups.forEach((g) => {
   const current = g.id === group.id;
   const incomplete = groupHasUnsetRequired(g, row);
   row1.addComponents(
    new ButtonBuilder()
     .setStyle(current ? ButtonStyle.Primary : ButtonStyle.Secondary)
     .setLabel(incomplete ? `${g.label} ${emotes.warning.name}` : g.label)
     .setEmoji(buttonEmoji(g.emote ?? emotes.settings))
     .setDisabled(current)
     .setCustomId(
      encodeSettingsId({
       action: SettingsAction.GroupNav,
       settingName,
       rowId,
       groupId: g.id,
       hideUnavail,
      }),
     ),
   );
  });
  page.push(row1);
 } else {
  const select = new StringSelectMenuBuilder()
   .setCustomId(
    encodeSettingsId({ action: SettingsAction.GroupNav, settingName, rowId, hideUnavail }),
   )
   .setPlaceholder(group.label)
   .setMinValues(1)
   .setMaxValues(1)
   .setOptions(
    schema.groups.map((g) => ({
     label: groupHasUnsetRequired(g, row) ? `${g.label} ${emotes.warning.name}` : g.label,
     value: g.id,
     default: g.id === group.id,
     description: g.description,
     emoji: buttonEmoji(g.emote ?? emotes.settings),
    })),
   );
  page.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
 }

 if (schema.multiRow) {
  page.push(
   new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
     .setStyle(ButtonStyle.Secondary)
     .setLabel(t.navigator.back())
     .setEmoji(buttonEmoji(emotes.back))
     .setCustomId(encodeSettingsId({ action: SettingsAction.Nav, settingName })),
   ),
  );
 }

 return page;
};
