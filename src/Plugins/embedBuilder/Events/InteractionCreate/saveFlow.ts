import { LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import {
 TextInputStyle,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { findModalValue } from '../../../../Util/findModalValue.js';
import { EmbedBuilderRoute } from '../../Classes/Routes.js';
import CustomEmbed from '../../CustomEmbed.js';
import type EmbedBuilderPlugin from '../../Plugin.js';
import { authorizeManage, builderContext, ephemeralNote } from '../../Util/builderContext.js';
import { isSendable } from '../../Util/builderState.js';

export const saveOpen = async function (
 this: EmbedBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(EmbedBuilderRoute.SaveSubmit))
  .setTitle(t.save.title())
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.base.t.name())
    .setDescription(t.save.nameHint())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId('name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100),
    ),
  );

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening embed save modal',
 });
};

export const saveSubmit = async function (
 this: EmbedBuilderPlugin,
 cmd: APIModalSubmitInteraction,
) {
 if (!cmd.guild_id) return;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;
 if (!(await authorizeManage.call(this, cmd))) return;

 const t = await this.t(cmd.guild_id);
 const name = (findModalValue(cmd.data.components, 'name') || '').trim().slice(0, 100);
 if (!name || !isSendable(ctx.view.embed)) return;

 try {
  await CustomEmbed.save(this.client, cmd.guild_id, name, ctx.view.embed);
 } catch (error) {
  this.nonFatalError(error as Error, 'saveSubmit');
  ephemeralNote.call(this, cmd, (error as Error).message);
  return;
 }

 ephemeralNote.call(this, cmd, t.save.saved({ name }));
};
