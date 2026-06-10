import type { ContainerBuilder } from '@discordjs/builders';
import {
 ActionRowBuilder,
 ButtonBuilder,
 ChannelSelectMenuBuilder,
 MentionableSelectMenuBuilder,
 RoleSelectMenuBuilder,
 SectionBuilder,
 StringSelectMenuBuilder,
 TextDisplayBuilder,
 UserSelectMenuBuilder,
} from '@discordjs/builders';
import { ButtonStyle, ChannelType } from 'discord-api-types/v10';

import emotes from '../../../Classes/Emotes.js';
import { formatDurationSeconds } from '../../../Util/durationSeconds.js';
import { EditorType } from '../EditorType.js';
import { FieldArity, type SettingsField, type ShowIfResult } from '../SettingsSchema.js';

import { SettingsAction } from './customId.js';
import editorEmotes from './editorEmotes.js';
import { InlineKind, resolveInlineKind } from './resolveInlineKind.js';
import { buttonEmoji, textEmote } from './settingsEmotes.js';

export interface InlineFieldChrome {
 enabled: string;
 disabled: string;
 change: string;
}

const toIds = (value: unknown): string[] => {
 if (Array.isArray(value)) return value.map((entry) => String(entry)).filter((id) => id.length > 0);
 if (value === undefined || value === null || value === '') return [];
 return [String(value)];
};

const asOptions = (field: SettingsField): { label: string; value: string }[] => {
 if (Array.isArray(field.options)) return field.options;
 return [];
};

const heading = (field: SettingsField, prefix: string): string => {
 const title = prefix ? `### ${prefix} ${field.label}` : `### ${field.label}`;
 return field.description ? `${title}\n-# ${field.description}` : title;
};

const editorPrefix = (field: SettingsField, value?: unknown): string => {
 const emote = editorEmotes.forEditor(field.editor, value);
 return emote ? textEmote(emote) : '';
};

const withReason = (text: string, visible: ShowIfResult): string => {
 if (visible.ok) return text;
 return `${text}\n-# ${visible.reason ?? ''}`;
};

const renderEntitySelect = (
 field: SettingsField,
 value: unknown,
 customId: string,
 disabled: boolean,
):
 | RoleSelectMenuBuilder
 | UserSelectMenuBuilder
 | ChannelSelectMenuBuilder
 | MentionableSelectMenuBuilder => {
 const maxValues = field.arity === FieldArity.Multi ? 25 : 1;
 const ids = toIds(value);

 switch (field.editor) {
  case EditorType.Role:
  case EditorType.Roles:
   return new RoleSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(0)
    .setMaxValues(maxValues)
    .setDefaultRoles(ids)
    .setDisabled(disabled);
  case EditorType.User:
  case EditorType.Users:
   return new UserSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(0)
    .setMaxValues(maxValues)
    .setDefaultUsers(ids)
    .setDisabled(disabled);
  case EditorType.Mention:
  case EditorType.Mentions:
   return new MentionableSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(0)
    .setMaxValues(maxValues)
    .setDisabled(disabled);
  case EditorType.Category:
   return new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(0)
    .setMaxValues(maxValues)
    .setChannelTypes(ChannelType.GuildCategory)
    .setDefaultChannels(ids)
    .setDisabled(disabled);
  default:
   return new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(0)
    .setMaxValues(maxValues)
    .setDefaultChannels(ids)
    .setDisabled(disabled);
 }
};

export const renderInlineField = (
 container: ContainerBuilder,
 field: SettingsField,
 row: Record<string, unknown>,
 customIdFor: (action: SettingsAction, column: string) => string,
 chrome: InlineFieldChrome,
 visible: ShowIfResult,
): void => {
 const value = row[field.column];
 const disabled = !visible.ok;
 const kind = resolveInlineKind(field);

 switch (kind) {
  case InlineKind.Toggle: {
   const on = Boolean(value);
   container.addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(withReason(heading(field, ''), visible)),
     )
     .setButtonAccessory(
      new ButtonBuilder()
       .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary)
       .setLabel(on ? chrome.enabled : chrome.disabled)
       .setEmoji(buttonEmoji(on ? emotes.enabled : emotes.disabled))
       .setDisabled(disabled)
       .setCustomId(customIdFor(SettingsAction.ToggleField, field.column)),
     ),
   );
   return;
  }
  case InlineKind.Select: {
   const multi = field.arity === FieldArity.Multi;
   const options = asOptions(field);
   container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(withReason(heading(field, editorPrefix(field)), visible)),
   );
   container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
     new StringSelectMenuBuilder()
      .setCustomId(customIdFor(SettingsAction.SetField, field.column))
      .setMinValues(0)
      .setMaxValues(multi ? Math.max(1, options.length) : 1)
      .setDisabled(disabled)
      .setOptions(
       options.map((o) => ({
        ...o,
        default: multi
         ? Array.isArray(value) && value.includes(o.value)
         : String(value) === o.value,
       })),
      ),
    ),
   );
   return;
  }
  case InlineKind.Entity: {
   const select = renderEntitySelect(
    field,
    value,
    customIdFor(SettingsAction.SetField, field.column),
    disabled,
   );
   container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
     withReason(heading(field, editorPrefix(field, ChannelType.GuildText)), visible),
    ),
   );
   if (select instanceof RoleSelectMenuBuilder) {
    container.addActionRowComponents(
     new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select),
    );
   } else if (select instanceof UserSelectMenuBuilder) {
    container.addActionRowComponents(
     new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select),
    );
   } else if (select instanceof MentionableSelectMenuBuilder) {
    container.addActionRowComponents(
     new ActionRowBuilder<MentionableSelectMenuBuilder>().addComponents(select),
    );
   } else {
    container.addActionRowComponents(
     new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select),
    );
   }
   return;
  }
  default: {
   const durationText =
    field.editor === EditorType.Duration ? formatDurationSeconds(Number(value)) : null;
   const preview = field.secret
    ? ''
    : durationText !== null
      ? durationText
        ? `\n> \`${durationText}\``
        : ''
      : Array.isArray(value)
        ? value.length
          ? `\n> ${value.map((entry) => `\`${String(entry)}\``).join(', ')}`
          : ''
        : value === undefined || value === null || value === ''
          ? ''
          : `\n> \`${String(value)}\``;
   container.addSectionComponents(
    new SectionBuilder()
     .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
       withReason(`${heading(field, editorPrefix(field))}${preview}`, visible),
      ),
     )
     .setButtonAccessory(
      new ButtonBuilder()
       .setStyle(ButtonStyle.Secondary)
       .setLabel(chrome.change)
       .setEmoji(buttonEmoji(emotes.edit))
       .setDisabled(disabled)
       .setCustomId(customIdFor(SettingsAction.FieldModal, field.column)),
     ),
   );
  }
 }
};
