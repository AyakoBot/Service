import {
 ChannelSelectMenuBuilder,
 MentionableSelectMenuBuilder,
 RoleSelectMenuBuilder,
 UserSelectMenuBuilder,
} from '@discordjs/builders';
import { ChannelType } from 'discord-api-types/v10';

import { EditorType } from '../EditorType.js';
import { FieldArity, type SettingsField } from '../SettingsSchema.js';

const toIds = (value: unknown): string[] => {
 if (Array.isArray(value)) return value.map((entry) => String(entry)).filter((id) => id.length > 0);
 if (value === undefined || value === null || value === '') return [];
 return [String(value)];
};

export const asOptions = (field: SettingsField): { label: string; value: string }[] => {
 if (Array.isArray(field.options)) return field.options;
 return [];
};

export type EntitySelectBuilder =
 | RoleSelectMenuBuilder
 | UserSelectMenuBuilder
 | ChannelSelectMenuBuilder
 | MentionableSelectMenuBuilder;

export const buildEntitySelect = (
 field: SettingsField,
 value: unknown,
 customId: string,
): EntitySelectBuilder => {
 const maxValues = field.arity === FieldArity.Multi ? 25 : 1;
 const ids = toIds(value);

 switch (field.editor) {
  case EditorType.Role:
  case EditorType.Roles:
   return new RoleSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(0)
    .setMaxValues(maxValues)
    .setDefaultRoles(ids);
  case EditorType.User:
  case EditorType.Users:
   return new UserSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(0)
    .setMaxValues(maxValues)
    .setDefaultUsers(ids);
  case EditorType.Mention:
  case EditorType.Mentions:
   return new MentionableSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(0)
    .setMaxValues(maxValues);
  case EditorType.Category:
   return new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(0)
    .setMaxValues(maxValues)
    .setChannelTypes(ChannelType.GuildCategory)
    .setDefaultChannels(ids);
  default: {
   const select = new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(0)
    .setMaxValues(maxValues)
    .setDefaultChannels(ids);
   if (field.channelTypes?.length) select.setChannelTypes(...field.channelTypes);
   return select;
  }
 }
};
