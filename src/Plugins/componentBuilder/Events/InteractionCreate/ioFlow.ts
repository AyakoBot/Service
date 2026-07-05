import { txtFileWriter } from '@ayako/utility';
import {
 LabelBuilder,
 ModalBuilder,
 TextDisplayBuilder,
 TextInputBuilder,
} from '@discordjs/builders';
import {
 MessageFlags,
 TextInputStyle,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { isLink, resolveDiscohookLink } from '../../../../Util/discohookLink.js';
import { findModalValue } from '../../../../Util/findModalValue.js';
import { detectMessageJsonKind, MessageJsonKind } from '../../../../Util/messageJsonKind.js';
import { RespondMode } from '../../../../Util/respondMode.js';
import {
 EmbedBuilderCommand,
 EmbedBuilderSubcommand,
} from '../../../embedBuilder/Classes/Commands.js';
import { ComponentBuilderRoute } from '../../Classes/Routes.js';
import type ComponentBuilderPlugin from '../../Plugin.js';
import { applyErrorText } from '../../Util/applyErrorText.js';
import { builderContext, ephemeralNote } from '../../Util/builderContext.js';
import { parseMarker } from '../../Util/builderState.js';
import {
 normalizeImport,
 stripIds,
 validateTree,
 type WipTree,
} from '../../Util/componentTree.js';
import { renderBuilder } from '../../Util/renderBuilder.js';

import { openIntoThread } from './start.js';

const inputIds = ['json0', 'json1', 'json2'];
const inputLength = 4000;

export const importOpen = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(ComponentBuilderRoute.ImportSave))
  .setTitle(t.io.importTitle().slice(0, 45))
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

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening components JSON import modal',
 });
};

export const importSave = async function (
 this: ComponentBuilderPlugin,
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

 let tree: WipTree | null = normalizeImport(parsed);
 if (!tree) {
  ephemeralNote.call(
   this,
   cmd,
   detectMessageJsonKind(parsed) === MessageJsonKind.Embeds
    ? t.io.embedsDetected({
       command: `\`/${EmbedBuilderCommand.EmbedBuilder} ${EmbedBuilderSubcommand.Create}\``,
      })
    : t.errors.invalidJson(),
  );
  return;
 }

 tree = stripIds(tree);
 const validationError = validateTree(tree);
 if (validationError) {
  ephemeralNote.call(this, cmd, applyErrorText(t, validationError));
  return;
 }

 if (cmd.message && parseMarker(cmd.message)) {
  const ctx = await builderContext.call(this, cmd);
  if (!ctx) return;
  renderBuilder.call(this, t, { ...ctx.view, tree, selectedPath: null }).update(cmd);
  return;
 }

 await openIntoThread.call(this, cmd, tree, RespondMode.Update);
};

export const exportJson = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 new MessagePayload(this.client, { origin: this.name, reason: 'Components JSON export' })
  .setFiles([txtFileWriter(JSON.stringify(ctx.view.tree, null, 2), 'components')])
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
