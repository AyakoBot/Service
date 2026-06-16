import type { Snippets } from '@ayako/database';
import { LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import {
 MessageFlags,
 TextInputStyle,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { PageDirection } from '../../Classes/Enums.js';
import { TicketRoute } from '../../Classes/Routes.js';
import Snippet from '../../Classes/Snippet.js';
import type TicketPlugin from '../../Plugin.js';
import { authorizeManage } from '../../Util/authorizeManage.js';
import runSnippet from '../../Util/runSnippet.js';
import { buildToolkit } from '../../Util/tagToolkit.js';

export const tagSend = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;

 const snippet = await this.client.db.client.snippets.findUnique({ where: { id: args[0] } });
 const staffId = cmd.member?.user.id || cmd.user?.id;
 const t = await this.t(cmd.guild_id);

 if (!snippet || !staffId) {
  tagWarn.call(this, cmd, t.tag.errors.notFound());
  return;
 }

 await runSnippet.call(this, cmd, snippet, cmd.channel.id, staffId, cmd.guild_id);
};

export const tagPage = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;

 const [dir, currentArg] = args;
 const current = Number(currentArg) || 0;
 const page = dir === PageDirection.Next ? current + 1 : current - 1;

 const snippets = await Snippet.all(this.client, cmd.guild_id);
 const payload = await buildToolkit.call(this, cmd.guild_id, snippets, { page });
 payload.update(cmd);
};

export const tagManage = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 manage: boolean,
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const snippets = await Snippet.all(this.client, cmd.guild_id);
 const payload = await buildToolkit.call(this, cmd.guild_id, snippets, { page: 0, manage });
 payload.update(cmd);
};

export const tagDelete = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const deleted = await this.client.db.client.snippets
  .delete({ where: { id: args[0] } })
  .catch((error: Error) => error);
 if (deleted instanceof Error) {
  this.nonFatalError(deleted, 'tagDelete');
  tagWarn.call(this, cmd, (await this.t(cmd.guild_id)).base.errors.unknownError());
  return;
 }

 const snippets = await Snippet.all(this.client, cmd.guild_id);
 const payload = await buildToolkit.call(this, cmd.guild_id, snippets, { page: 0, manage: true });
 payload.update(cmd);
};

export const tagSearch = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);
 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(TicketRoute.TagSearchModal))
  .setTitle(t.tag.search())
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.tag.searchLabel())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId('query')
      .setStyle(TextInputStyle.Short)
      .setRequired(false),
    ),
  );

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening snippet search modal',
 });
};

export const tagAdd = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const modal = buildSnippetModal(t, this.getRoute(TicketRoute.TagAddModal));

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening snippet authoring modal',
 });
};

const buildSnippetModal = (
 t: Awaited<ReturnType<TicketPlugin['t']>>,
 customId: string,
 snippet?: Snippets,
) => {
 const nameInput = new TextInputBuilder()
  .setCustomId('name')
  .setStyle(TextInputStyle.Short)
  .setRequired(true)
  .setMaxLength(80);
 if (snippet) nameInput.setValue(snippet.name);

 const userInput = new TextInputBuilder()
  .setCustomId('userText')
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(false);
 if (snippet?.userText) userInput.setValue(snippet.userText);

 const staffInput = new TextInputBuilder()
  .setCustomId('staffText')
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(false);
 if (snippet?.staffText) staffInput.setValue(snippet.staffText);

 const kindsInput = new TextInputBuilder()
  .setCustomId('kinds')
  .setStyle(TextInputStyle.Short)
  .setRequired(false);
 if (snippet?.kinds.length) kindsInput.setValue(snippet.kinds.join(', '));

 return new ModalBuilder()
  .setCustomId(customId)
  .setTitle(snippet ? t.tag.editTitle() : t.tag.addTitle())
  .addLabelComponents(
   new LabelBuilder().setLabel(t.base.t.name()).setTextInputComponent(nameInput),
   new LabelBuilder().setLabel(t.tag.fields.userText()).setTextInputComponent(userInput),
   new LabelBuilder().setLabel(t.tag.fields.staffText()).setTextInputComponent(staffInput),
   new LabelBuilder().setLabel(t.tag.fields.kinds()).setTextInputComponent(kindsInput),
  );
};

export const tagEdit = async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild_id) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const snippet = await Snippet.byId(this.client, args[0]);
 if (!snippet) {
  tagWarn.call(this, cmd, t.tag.errors.notFound());
  return;
 }

 const modal = buildSnippetModal(t, this.getRoute(TicketRoute.TagEditModal, snippet.id), snippet);

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening snippet edit modal',
 });
};

const tagWarn = function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 message: string,
) {
 new MessagePayload(this.client, { origin: this.name, reason: 'Tag editor warning' })
  .setContent(message)
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
};
