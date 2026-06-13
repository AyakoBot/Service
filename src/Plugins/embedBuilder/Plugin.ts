import type { CustomEmbed as CustomEmbedRow } from '@ayako/database';
import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { type GatewayDispatchEvents } from '@discordjs/core';
import type { APIEmbed } from 'discord-api-types/v10';

import Plugin, {
 idSelector,
 SettingsCategory,
 type BaseLang,
} from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import emotes from '../../Classes/Emotes.js';
import type { TranslatorType } from '../../Util/translator.js';
import { EditorType } from '../settings/Plugin.js';
import {
 assertSchemaValid,
 FieldArity,
 type SettingsSchemaDef,
} from '../settings/SettingsSchema.js';

import { EmbedBuilderCommand, EmbedBuilderSubcommand } from './Classes/Commands.js';
import { EmbedBuilderRoute } from './Classes/Routes.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };
import { isSendable } from './Util/builderState.js';

type Events = GatewayDispatchEvents.InteractionCreate | GatewayDispatchEvents.MessageCreate;
type APILanguage = typeof en;
type EmbedBuilderTranslator = TranslatorType<APILanguage> & { base: BaseLang };

export enum EmbedBuilderGroups {
 Embed = 'embed',
}

export default class EmbedBuilderPlugin extends Plugin<Events, APILanguage> {
 name = 'Embed Builder';
 settingName = 'embed-builder';
 tableName = 'CustomEmbed';

 /* eslint-disable @typescript-eslint/naming-convention */
 languageFiles = {
  'en-GB': en,
 };

 eventHandlers = {
  INTERACTION_CREATE: (data) => {
   if (
    !data.guild_id
     ? !this.client.debugUsers.includes(data.user?.id || '')
     : !this.client.debugGuilds.includes(data.guild_id || '')
   ) {
    return; // TODO: remove
   }
   if (!this.isEnabled()) return;

   interactionCreate.call(this, data);
  },
  MESSAGE_CREATE: (data) => {
   if (
    !data.guild_id
     ? !this.client.debugUsers.includes(data.author.id || '')
     : !this.client.debugGuilds.includes(data.guild_id || '')
   ) {
    return; // TODO: remove
   }
   if (!this.isEnabled()) return;

   messageCreate.call(this, data);
  },
 } as Plugin<Events, APILanguage>['eventHandlers'];
 /* eslint-enable @typescript-eslint/naming-convention */

 constructor(client: Client) {
  super(client);
  assertSchemaValid(this.settingsSchema);
 }

 getCommands = () => ({
  commands: [
   new SlashCommandBuilder()
    .setName(EmbedBuilderCommand.EmbedBuilder)
    .setDescription('Build, save, send, and edit message embeds')
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(EmbedBuilderSubcommand.Create)
      .setDescription('Open the embed builder'),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(EmbedBuilderSubcommand.ViewMessage)
      .setDescription("Export a message's embeds as JSON")
      .addStringOption((option) =>
       option
        .setName('message-link')
        .setDescription('Link to the message whose embeds you want')
        .setRequired(true),
      ),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(EmbedBuilderSubcommand.ViewSaved)
      .setDescription('Export a saved embed as JSON')
      .addStringOption((option) =>
       option
        .setName('name')
        .setDescription('The saved embed to export')
        .setRequired(true)
        .setAutocomplete(true),
      ),
    ),
  ],
  settings: [
   {
    category: SettingsCategory.Utility,
    commands: [
     new SlashCommandSubcommandBuilder()
      .setName('embed-builder')
      .setDescription('Manage the saved embeds of your Server')
      .addStringOption(idSelector),
    ],
   },
  ],
 });

 settingsSchema = {
  table: 'customEmbed',
  rowKey: 'id',
  multiRow: true,
  title: (t: EmbedBuilderTranslator) => t.settings.configTitle(),
  overviewDescription: (t: EmbedBuilderTranslator) => t.settings.overviewDescription(),
  rowLabel: (t: EmbedBuilderTranslator, row: CustomEmbedRow) =>
   row.name || t.settings.unnamed(),
  rowSummary: (t: EmbedBuilderTranslator, row: CustomEmbedRow) => {
   const embed = (row.embed ?? {}) as APIEmbed;
   const state = isSendable(embed) ? t.settings.stateReady() : t.settings.stateEmpty();
   const preview = (embed.title || embed.description || '').replace(/\s+/g, ' ').slice(0, 40);
   return t.settings.rowSummary({ state, preview: preview || t.builder.notSet() });
  },
  groups: [
   {
    id: EmbedBuilderGroups.Embed,
    label: (t: EmbedBuilderTranslator) => t.settings.groups.embed(),
    emote: emotes.json,
    fields: [
     {
      column: 'name',
      editor: EditorType.String,
      label: (t: EmbedBuilderTranslator) => t.base.t.name(),
      description: (t: EmbedBuilderTranslator) => t.settings.descriptions.name(),
      arity: FieldArity.Single,
      required: true,
     },
    ],
    actions: [
     {
      customId: EmbedBuilderRoute.OpenBuilder,
      label: (t: EmbedBuilderTranslator) => t.builder.title(),
      description: (t: EmbedBuilderTranslator) => t.settings.descriptions.openBuilder(),
      emote: emotes.edit,
     },
    ],
   },
  ],
 } satisfies SettingsSchemaDef<CustomEmbedRow, EmbedBuilderTranslator> as SettingsSchemaDef;
}
