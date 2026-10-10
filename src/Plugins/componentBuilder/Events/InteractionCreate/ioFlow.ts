import { commandMentions } from '../../../../Util/commandMention.js';
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
import { isLink, resolveBuilderLink } from '../../../../Util/builderLinks.js';
import { findModalValue } from '../../../../Util/findModalValue.js';
import { detectMessageJsonKind, MessageJsonKind } from '../../../../Util/messageJsonKind.js';
import { placeholderReference } from '../../../../Util/placeholderReference.js';
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
 adoptImport,
 normalizeImport,
 stripIds,
 validateTree,
 type WipTree,
} from '../../Util/componentTree.js';
import { presentBuilder } from '../../Util/presentBuilder.js';

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

 const api = await this.getInteractionAPI(cmd);
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
 const mention = await commandMentions.call(await this.getInteractionAPI(cmd));

 const code = inputIds
  .map((id) => findModalValue(cmd.data.components, id) || '')
  .join('')
  .trim();
 if (!code) return;

 let parsed: unknown;
 if (isLink(code)) {
  parsed = await resolveBuilderLink(code);
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
       command: mention(`${EmbedBuilderCommand.EmbedBuilder} ${EmbedBuilderSubcommand.Create}`),
      })
    : t.errors.invalidJson(),
  );
  return;
 }

 const adopted = adoptImport(stripIds(tree), this.bindings.claims);
 if (!adopted.ok) {
  ephemeralNote.call(this, cmd, applyErrorText(t, adopted.error));
  return;
 }
 tree = adopted.tree;

 const validationError = validateTree(tree, this.bindings.claims);
 if (validationError) {
  ephemeralNote.call(this, cmd, applyErrorText(t, validationError));
  return;
 }

 if (cmd.message && parseMarker(cmd.message)) {
  const ctx = await builderContext.call(this, cmd);
  if (!ctx) return;
  await presentBuilder.call(this, cmd, ctx.view.tree, { ...ctx.view, tree, selectedPath: null });
 } else {
  await openIntoThread.call(this, cmd, tree, RespondMode.Update);
 }

 if (adopted.dropped) {
  await followUpNote.call(this, cmd, t.io.droppedFiles({ count: String(adopted.dropped) }));
 }
};

const followUpNote = async function (
 this: ComponentBuilderPlugin,
 cmd: APIModalSubmitInteraction,
 content: string,
) {
 const api = await this.getInteractionAPI(cmd);
 await api.webhooks.execute(
  cmd.application_id,
  cmd.token,
  { content, flags: MessageFlags.Ephemeral },
  { origin: this.name, reason: 'Component builder import note' },
 );
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

export const placeholders = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx || !cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);
 const content = await placeholderReference.call(
  this.client,
  t.base.placeholders,
  cmd.application_id,
  cmd.guild_id,
 );

 new MessagePayload(this.client, { origin: this.name, reason: 'Component placeholders' })
  .setContent(content)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
