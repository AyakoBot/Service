import type { ContainerBuilder ,
 ChannelSelectMenuBuilder } from '@discordjs/builders';
import {
 ActionRowBuilder,
 ButtonBuilder,
 MentionableSelectMenuBuilder,
 RoleSelectMenuBuilder,
 SectionBuilder,
 StringSelectMenuBuilder,
 TextDisplayBuilder,
 UserSelectMenuBuilder,
} from '@discordjs/builders';
import { ButtonStyle, ChannelType } from 'discord-api-types/v10';

import type { EmoteSet } from '../../../Classes/EmojiRegistry.js';
import { formatDurationSeconds } from '../../../Util/durationSeconds.js';
import { EditorType } from '../EditorType.js';
import { FieldArity, type SettingsField, type ShowIfResult } from '../SettingsSchema.js';

import { SettingsAction } from './customId.js';
import editorEmotes from './editorEmotes.js';
import { asOptions, buildEntitySelect, type EntitySelectBuilder } from './fieldValueHelpers.js';
import { InlineKind, resolveInlineKind } from './resolveInlineKind.js';
import { buttonEmoji, textEmote } from './settingsEmotes.js';

export interface InlineFieldChrome {
 enabled: string;
 disabled: string;
 change: string;
}

const heading = (field: SettingsField, prefix: string): string => {
 const title = prefix ? `### ${prefix} ${field.label}` : `### ${field.label}`;
 return field.description ? `${title}\n-# ${field.description}` : title;
};

const editorPrefix = (emotes: EmoteSet, field: SettingsField, value?: unknown): string => {
 const emote = editorEmotes.forEditor(emotes, field.editor, value);
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
): EntitySelectBuilder => {
 const select = buildEntitySelect(field, value, customId);
 select.setDisabled(disabled);
 return select;
};

export const renderInlineField = (
 container: ContainerBuilder,
 emotes: EmoteSet,
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
    new TextDisplayBuilder().setContent(
     withReason(heading(field, editorPrefix(emotes, field)), visible),
    ),
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
     withReason(heading(field, editorPrefix(emotes, field, ChannelType.GuildText)), visible),
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
       withReason(`${heading(field, editorPrefix(emotes, field))}${preview}`, visible),
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
