import { txtFileWriter } from '@ayako/utility';
import { EmbedBuilder, LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import {
 MessageFlags,
 TextInputStyle,
 type APIEmbed,
 type APIMessage,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { findModalValue } from '../../../settings/Util/findModalValue.js';
import { EmbedBuilderRoute } from '../../Classes/Routes.js';
import type EmbedBuilderPlugin from '../../Plugin.js';
import { builderContext, ephemeralNote } from '../../Util/builderContext.js';
import { parseMarker } from '../../Util/builderState.js';
import { renderBuilder } from '../../Util/renderBuilder.js';

import { openIntoThread } from './start.js';

const inputIds = ['json0', 'json1', 'json2'];
const inputLength = 4000;

const extractEmbed = (parsed: APIEmbed | APIEmbed[] | APIMessage): APIEmbed => {
 if (Array.isArray(parsed)) return parsed[0] ?? {};
 if ('embeds' in parsed && Array.isArray(parsed.embeds)) return parsed.embeds[0] ?? {};
 return parsed as APIEmbed;
};

export const importOpen = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 const t = await this.t(cmd.guild_id);

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(EmbedBuilderRoute.ImportSave))
  .setTitle(t.io.importTitle())
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

 let embed: APIEmbed;
 try {
  embed = extractEmbed(JSON.parse(code) as APIEmbed | APIEmbed[] | APIMessage);
  new EmbedBuilder(embed).toJSON();
 } catch {
  ephemeralNote.call(this, cmd, t.errors.invalidJson());
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

 await openIntoThread.call(this, cmd, embed, 'update');
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
