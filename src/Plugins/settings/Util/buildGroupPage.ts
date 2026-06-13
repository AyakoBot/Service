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
import type { SettingsField, SettingsGroup, SettingsSchema } from '../SettingsSchema.js';

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

const isGroupAvailable = (group: SettingsGroup, row: Record<string, unknown>): boolean =>
 !group.showIf || group.showIf(row).ok;

const isFieldAvailable = (field: SettingsField, row: Record<string, unknown>): boolean =>
 !field.showIf || field.showIf(row).ok;

const groupHasUnsetRequired = (group: SettingsGroup, row: Record<string, unknown>): boolean =>
 group.fields.some(
  (field) => field.required && isFieldAvailable(field, row) && isUnset(row[field.column]),
 );

export const visibleGroups = (
 schema: SettingsSchema,
 row: Record<string, unknown>,
): SettingsGroup[] => schema.groups.filter((group) => isGroupAvailable(group, row));

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

 const summary = schema.rowSummary?.(row) ?? `${t.navigator.numberLabel()} #${rowId}`;
 const headerText = `# ${textEmote(emotes.settings)} ${schema.rowLabel(row)}\n-# ${summary}`;

 const header: TopLevelBuilder = schema.multiRow
  ? new SectionBuilder()
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
     .setButtonAccessory(
      new ButtonBuilder()
       .setStyle(ButtonStyle.Danger)
       .setEmoji(buttonEmoji(emotes.trash))
       .setLabel(t.base.t.Delete())
       .setCustomId(idFor(SettingsAction.Delete, group.id)),
     )
  : new TextDisplayBuilder().setContent(headerText);

 const container = new ContainerBuilder();

 const toggleField = group.fields.find((field) => field.headerToggle);
 const groupHeading = `## ${textEmote(group.emote ?? emotes.settings)} ${group.label}${
  group.description ? `\n-# ${group.description}` : ''
 }`;

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

 if (group.actions?.length) {
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  group.actions.forEach((action) => {
   const actionText = `### ${action.emote ? `${textEmote(action.emote)} ` : ''}${action.label}${
    action.description ? `\n-# ${action.description}` : ''
   }`;
   container.addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(new TextDisplayBuilder().setContent(actionText))
     .setButtonAccessory(
      new ButtonBuilder()
       .setStyle(ButtonStyle.Secondary)
       .setLabel(action.buttonLabel ?? t.base.t.Open())
       .setCustomId(`${action.customId}_${rowId}`),
     ),
   );
  });
 }

 const hasUnavailable = group.fields.some(
  (field) => !field.headerToggle && !isFieldAvailable(field, row),
 );

 if (hasUnavailable) {
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addSectionComponents(
   new SectionBuilder()
    .addTextDisplayComponents(
     new TextDisplayBuilder().setContent(`-# ${t.navigator.unavailHint()}`),
    )
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
 }

 const page: TopLevelBuilder[] = [header, container];
 const groups = visibleGroups(schema, row);
 const useSelect = groups.length > 5;

 if (useSelect) {
  const select = new StringSelectMenuBuilder()
   .setCustomId(
    encodeSettingsId({ action: SettingsAction.GroupNav, settingName, rowId, hideUnavail }),
   )
   .setPlaceholder(group.label)
   .setMinValues(1)
   .setMaxValues(1)
   .setOptions(
    groups.map((g) => ({
     label: groupHasUnsetRequired(g, row) ? `${g.label} ${t.navigator.incomplete()}` : g.label,
     value: g.id,
     default: g.id === group.id,
     description: g.description,
     emoji: buttonEmoji(g.emote ?? emotes.settings),
    })),
   );
  page.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
 } else if (groups.length > 1) {
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  groups.forEach((g) => {
   const current = g.id === group.id;
   const incomplete = groupHasUnsetRequired(g, row);
   row1.addComponents(
    new ButtonBuilder()
     .setStyle(current ? ButtonStyle.Primary : ButtonStyle.Secondary)
     .setLabel(incomplete ? `${g.label} ${t.navigator.incomplete()}` : g.label)
     .setEmoji(buttonEmoji(g.emote ?? emotes.settings))
     .setDisabled(current)
     .setCustomId(idFor(SettingsAction.GroupNav, g.id)),
   );
  });
  page.push(row1);
 }

 const navButtons: ButtonBuilder[] = [];

 if (schema.multiRow) {
  navButtons.push(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel(t.navigator.back())
    .setEmoji(buttonEmoji(emotes.back))
    .setCustomId(encodeSettingsId({ action: SettingsAction.Nav, settingName })),
  );
 }

 const index = groups.findIndex((g) => g.id === group.id);
 if (useSelect && index !== -1) {
  const prevGroup = groups[(index - 1 + groups.length) % groups.length];
  const nextGroup = groups[(index + 1) % groups.length];
  navButtons.push(
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(buttonEmoji(emotes.prev))
    .setCustomId(idFor(SettingsAction.GroupNav, prevGroup.id)),
   new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(buttonEmoji(emotes.next))
    .setCustomId(idFor(SettingsAction.GroupNav, nextGroup.id)),
  );
 }

 if (navButtons.length) {
  page.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...navButtons));
 }

 return page;
};
