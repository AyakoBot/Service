import { txtFileWriter } from '@ayako/utility';
import {
 EmbedBuilder,
 LabelBuilder,
 ModalBuilder,
 TextDisplayBuilder,
 TextInputBuilder,
} from '@discordjs/builders';
import {
 MessageFlags,
 TextInputStyle,
 type APIEmbed,
 type APIMessage,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { isLink, resolveDiscohookLink } from '../../../../Util/discohookLink.js';
import { findModalValue } from '../../../../Util/findModalValue.js';
import { detectMessageJsonKind, MessageJsonKind } from '../../../../Util/messageJsonKind.js';
import { renderPlaceholderList } from '../../../../Util/messagePlaceholders.js';
import { RespondMode } from '../../../../Util/respondMode.js';
import {
 ComponentBuilderCommand,
 ComponentBuilderSubcommand,
} from '../../../componentBuilder/Classes/Commands.js';
import { EmbedProperty, fieldLimit, propertyLengths } from '../../Classes/Properties.js';
import { EmbedBuilderRoute } from '../../Classes/Routes.js';
import type EmbedBuilderPlugin from '../../Plugin.js';
import { builderContext, ephemeralNote } from '../../Util/builderContext.js';
import { parseMarker } from '../../Util/builderState.js';
import { placeholderScope, type PlaceholderGroup } from '../../Util/placeholderList.js';
import { renderBuilder } from '../../Util/renderBuilder.js';

import { openIntoThread } from './start.js';

const inputIds = ['json0', 'json1', 'json2'];
const inputLength = 4000;

const extractEmbed = (parsed: APIEmbed | APIEmbed[] | APIMessage): APIEmbed => {
 if (Array.isArray(parsed)) return parsed[0] ?? {};
 if ('embeds' in parsed && Array.isArray(parsed.embeds)) return parsed.embeds[0] ?? {};
 return parsed as APIEmbed;
};

const withinLimits = (embed: APIEmbed): boolean =>
 (embed.fields?.length ?? 0) <= fieldLimit &&
 (embed.title?.length ?? 0) <= (propertyLengths[EmbedProperty.Title] ?? Infinity) &&
 (embed.description?.length ?? 0) <= (propertyLengths[EmbedProperty.Description] ?? Infinity) &&
 (embed.author?.name.length ?? 0) <= (propertyLengths[EmbedProperty.AuthorName] ?? Infinity) &&
 (embed.footer?.text.length ?? 0) <= (propertyLengths[EmbedProperty.FooterText] ?? Infinity) &&
 (embed.fields ?? []).every(
  (field) =>
   field.name.length <= (propertyLengths[EmbedProperty.FieldName] ?? Infinity) &&
   field.value.length <= (propertyLengths[EmbedProperty.FieldValue] ?? Infinity),
 );

export const importOpen = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(EmbedBuilderRoute.ImportSave))
  .setTitle(t.io.importTitle())
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(t.io.guide()))
  .addLabelComponents(
   inputIds.map((id, index) =>
    new LabelBuilder()
     .setLabel(`${t.io.jsonLabel()} ${index + 1}`)
     .setDescription(t.io.jsonHint())
     .setTextInputComponent(
      new TextInputBuilder()
       .setCustomId(id)
       .setStyle(TextInputStyle.Paragraph)
       .setRequired(index === 0)
       .setMaxLength(inputLength),
     ),
   ),
  );

 const api = await this.getInteractionAPI(cmd);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening embed JSON import modal',
 });
};

export const importSave = async function (
 this: EmbedBuilderPlugin,
 cmd: APIModalSubmitInteraction,
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);

 const code = inputIds
  .map((id) => findModalValue(cmd.data.components, id) || '')
  .join('')
  .trim();
 if (!code) return;

 let parsed: unknown;
 if (isLink(code)) {
  parsed = await resolveDiscohookLink(code);
  if (parsed === null) {
   ephemeralNote.call(this, cmd, t.io.linkFailed());
   return;
  }
 } else {
  try {
   parsed = JSON.parse(code);
  } catch {
   ephemeralNote.call(this, cmd, t.errors.invalidJson());
   return;
  }
 }

 if (detectMessageJsonKind(parsed) === MessageJsonKind.ComponentsV2) {
  ephemeralNote.call(
   this,
   cmd,
   t.io.componentsDetected({
    command: `\`/${ComponentBuilderCommand.ComponentBuilder} ${ComponentBuilderSubcommand.Create}\``,
   }),
  );
  return;
 }

 let embed: APIEmbed;
 let valid: boolean;
 try {
  embed = extractEmbed(parsed as APIEmbed | APIEmbed[] | APIMessage);
  new EmbedBuilder(embed).toJSON();
  valid = withinLimits(embed);
 } catch {
  ephemeralNote.call(this, cmd, t.errors.invalidJson());
  return;
 }

 if (!valid) {
  ephemeralNote.call(this, cmd, t.errors.tooLong());
  return;
 }

 if (cmd.message && parseMarker(cmd.message)) {
  const ctx = await builderContext.call(this, cmd);
  if (!ctx) return;
  renderBuilder
   .call(this, t, { ...ctx.view, embed, selectedField: null, selectedProperty: null })
   .update(cmd);
  return;
 }

 await openIntoThread.call(this, cmd, embed, RespondMode.Update);
};

export const exportJson = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 new MessagePayload(this.client, { origin: this.name, reason: 'Embed JSON export' })
  .setFiles([txtFileWriter(JSON.stringify(ctx.view.embed, null, 2), 'embed')])
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};

export const placeholders = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const t = await this.t(cmd.guild_id);
 const scope = await placeholderScope(this.client, cmd.application_id, cmd.guild_id ?? '');

 const render = (group: PlaceholderGroup) =>
  `**${group.name}**\n${renderPlaceholderList(group.placeholders)}`;

 const sections = scope.owned.length
  ? scope.owned.map(render).join('\n\n')
  : t.placeholders.none();

 const footer = scope.others.length
  ? `\n\n-# ${t.placeholders.otherBots({ list: scope.others.map((g) => g.name).join(', ') })}`
  : '';

 new MessagePayload(this.client, { origin: this.name, reason: 'Embed placeholders' })
  .setContent(`### ${t.placeholders.title()}\n-# ${t.placeholders.intro()}\n\n${sections}${footer}`)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
