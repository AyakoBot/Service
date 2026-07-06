import type { CustomComponents as CustomComponentsRow } from '@ayako/database';
import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { PermissionFlagsBits, type GatewayDispatchEvents } from '@discordjs/core';

import Plugin, {
 idSelector,
 PluginName,
 SettingsCategory,
 type BaseLang,
} from '../../Classes/abstracts/Plugin.js';
import type Client from '../../Classes/Client.js';
import { EmoteName } from '../../Classes/EmoteName.js';
import type { TranslatorType } from '../../Util/translator.js';
import { EditorType } from '../settings/Plugin.js';
import {
 assertSchemaValid,
 FieldArity,
 type SettingsSchemaDef,
} from '../settings/SettingsSchema.js';

import { ComponentBuilderCommand, ComponentBuilderSubcommand } from './Classes/Commands.js';
import { wipComponentLimit } from './Classes/Nodes.js';
import { ComponentBuilderRoute } from './Classes/Routes.js';
import interactionCreate from './Events/InteractionCreate/index.js';
import messageCreate from './Events/MessageCreate/index.js';
import en from './Language/en-GB.json' with { type: 'json' };
import { isSendable } from './Util/builderState.js';
import { countComponents, type WipTree } from './Util/componentTree.js';

type Events = GatewayDispatchEvents.InteractionCreate | GatewayDispatchEvents.MessageCreate;
type APILanguage = typeof en;
type ComponentBuilderTranslator = TranslatorType<APILanguage> & { base: BaseLang };

export enum ComponentBuilderGroups {
 Message = 'message',
}

export default class ComponentBuilderPlugin extends Plugin<Events, APILanguage> {
 name = 'Component Builder';
 settingName = PluginName.ComponentBuilder;
 tableName = 'CustomComponents';

 customBotPerms =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.ManageWebhooks |
  PermissionFlagsBits.ReadMessageHistory;

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
    .setName(ComponentBuilderCommand.ComponentBuilder)
    .setDescription('Build, save, send, and edit Components-V2 messages')
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(ComponentBuilderSubcommand.Create)
      .setDescription('Open the component builder'),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(ComponentBuilderSubcommand.ViewMessage)
      .setDescription("Export a message's components as JSON")
      .addStringOption((option) =>
       option
        .setName('message-link')
        .setDescription('Link to the message whose components you want')
        .setRequired(true),
      ),
    )
    .addSubcommand(
     new SlashCommandSubcommandBuilder()
      .setName(ComponentBuilderSubcommand.ViewSaved)
      .setDescription('Export a saved component message as JSON')
      .addStringOption((option) =>
       option
        .setName('name')
        .setDescription('The saved message to export')
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
      .setName('component-builder')
      .setDescription('Manage the saved component messages of your Server')
      .addStringOption(idSelector),
    ],
   },
  ],
 });

 settingsSchema = {
  table: 'customComponents',
  rowKey: 'id',
  multiRow: true,
  title: (t: ComponentBuilderTranslator) => t.settings.configTitle(),
  overviewDescription: (t: ComponentBuilderTranslator) => t.settings.overviewDescription(),
  rowLabel: (t: ComponentBuilderTranslator, row: CustomComponentsRow) =>
   row.name || t.settings.unnamed(),
  rowSummary: (t: ComponentBuilderTranslator, row: CustomComponentsRow) => {
   const tree = (row.components ?? []) as unknown as WipTree;
   const state = isSendable(tree) ? t.settings.stateReady() : t.settings.stateEmpty();
   return t.settings.rowSummary({
    state,
    preview: t.builder.componentCount({
     count: String(countComponents(tree)),
     limit: String(wipComponentLimit),
    }),
   });
  },
  groups: [
   {
    id: ComponentBuilderGroups.Message,
    label: (t: ComponentBuilderTranslator) => t.settings.groups.message(),
    emote: EmoteName.Json,
    fields: [
     {
      column: 'name',
      editor: EditorType.String,
      label: (t: ComponentBuilderTranslator) => t.base.t.name(),
      description: (t: ComponentBuilderTranslator) => t.settings.descriptions.name(),
      arity: FieldArity.Single,
      required: true,
     },
    ],
    actions: [
     {
      customId: ComponentBuilderRoute.OpenBuilder,
      label: (t: ComponentBuilderTranslator) => t.builder.title(),
      description: (t: ComponentBuilderTranslator) => t.settings.descriptions.openBuilder(),
      emote: EmoteName.Edit,
     },
    ],
   },
  ],
 } satisfies SettingsSchemaDef<
  CustomComponentsRow,
  ComponentBuilderTranslator
 > as SettingsSchemaDef;
}
