import type { API } from '@ayako/api';
import { RequestHandlerError } from '@ayako/api';
import { LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import {
 AllowedMentionsTypes,
 ComponentType,
 MessageFlags,
 TextInputStyle,
 type APIAllowedMentions,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import { findModalValue } from '../../../../Util/findModalValue.js';
import { messageLinkPattern } from '../../../../Util/messageLink.js';
import { parseWebhookUrl } from '../../../../Util/parseWebhookUrl.js';
import { ComponentBuilderRoute } from '../../Classes/Routes.js';
import type ComponentBuilderPlugin from '../../Plugin.js';
import {
 authorizeManage,
 builderContext,
 ephemeralNote,
 type BuilderView,
} from '../../Util/builderContext.js';
import { buildMarkerUrl, isSendable, markerUrlLimit } from '../../Util/builderState.js';
import { collectCustomIds } from '../../Util/componentTree.js';
import { renderBuilder, SendMode, sendRows } from '../../Util/renderBuilder.js';

const sendMentionParse = [
 AllowedMentionsTypes.Everyone,
 AllowedMentionsTypes.Role,
 AllowedMentionsTypes.User,
];

const sendAllowedMentions: APIAllowedMentions = { parse: sendMentionParse };

const sendableContext = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return null;
 if (!(await authorizeManage.call(this, cmd))) return null;
 if (!isSendable(ctx.view.tree)) return null;
 return ctx;
};

const restoreBuilder = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 view: BuilderView,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 renderBuilder.call(this, t, { ...view, marker: { execId: view.marker.execId } }).update(cmd);
};

const followUpNote = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 content: string,
) {
 if (!cmd.guild_id) return;
 const api = await this.getAPI(cmd.guild_id);
 api.interactions.followUp(
  cmd.token,
  { content, flags: MessageFlags.Ephemeral },
  { origin: this.name, reason: 'Component builder send confirmation' },
 );
};

export const sendOpen = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await sendableContext.call(this, cmd);
 if (!ctx) return;

 const t = await this.t(cmd.guild_id ?? undefined);
 renderBuilder
  .call(this, t, ctx.view, sendRows.call(this, t, ctx.view, SendMode.Bot))
  .update(cmd);
};

export const sendTo = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 if (cmd.data.component_type !== ComponentType.ChannelSelect) return;
 const ctx = await sendableContext.call(this, cmd);
 if (!ctx) return;

 const t = await this.t(cmd.guild_id);
 const channels = cmd.data.values;

 await new MessagePayload(this.client, { origin: this.name, reason: 'Sending built components' })
  .setComponents(ctx.view.tree)
  .setFlags(MessageFlags.IsComponentsV2)
  .setAllowedMentionsParse(sendMentionParse)
  .setSendTo([{ channel: channels, guildId: cmd.guild_id }])
  .send();

 await restoreBuilder.call(this, cmd, ctx.view);
 await followUpNote.call(this, cmd, t.send.sent({ count: String(channels.length) }));
};

export const webhookOpen = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 const ctx = await sendableContext.call(this, cmd);
 if (!ctx) return;

 const t = await this.t(cmd.guild_id);

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(ComponentBuilderRoute.WebhookSubmit))
  .setTitle(t.send.webhookTitle().slice(0, 45))
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.send.webhookNameLabel())
    .setDescription(t.send.optionalHint())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId('name')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(80),
    ),
   new LabelBuilder()
    .setLabel(t.send.webhookAvatarLabel())
    .setDescription(t.send.optionalHint())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId('avatar')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(1024),
    ),
   new LabelBuilder()
    .setLabel(t.send.webhookUrlLabel())
    .setDescription(t.send.webhookUrlHint())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId('url')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(200)
      .setPlaceholder('https://discord.com/api/webhooks/…'),
    ),
  );

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening webhook identity modal',
 });
};

const sendToWebhookUrl = async function (
 this: ComponentBuilderPlugin,
 cmd: APIModalSubmitInteraction,
 view: BuilderView,
 url: string,
 username: string | undefined,
 avatarUrl: string | undefined,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 const guildId = cmd.guild_id;
 if (!guildId) return;

 const parsed = parseWebhookUrl(url);
 if (!parsed) {
  ephemeralNote.call(this, cmd, t.errors.invalidWebhookUrl());
  return;
 }

 const api = await this.getAPI(guildId);

 const webhook = await api.webhooks.get(parsed.id, { token: parsed.token }, {
  origin: this.name,
  reason: 'Validating existing webhook for components send',
 });
 if (webhook instanceof RequestHandlerError) {
  ephemeralNote.call(this, cmd, t.errors.webhookUnreachable());
  return;
 }
 if (webhook.guild_id !== guildId) {
  ephemeralNote.call(this, cmd, t.errors.webhookWrongGuild());
  return;
 }
 if (collectCustomIds(view.tree).length && webhook.application_id !== api.botId) {
  ephemeralNote.call(this, cmd, t.errors.webhookNoComponents());
  return;
 }

 const executed = await api.webhooks.execute(
  parsed.id,
  parsed.token,
  {
   components: view.tree,
   flags: MessageFlags.IsComponentsV2,
   username,
   avatar_url: avatarUrl,
   allowed_mentions: sendAllowedMentions,
   with_components: true,
  },
  { origin: this.name, reason: 'Sending built components via existing webhook' },
 );
 if (executed instanceof RequestHandlerError) {
  ephemeralNote.call(this, cmd, t.errors.webhookUnreachable());
  return;
 }

 await restoreBuilder.call(this, cmd, view);
 await followUpNote.call(this, cmd, t.send.sent({ count: '1' }));
};

export const webhookSubmit = async function (
 this: ComponentBuilderPlugin,
 cmd: APIModalSubmitInteraction,
) {
 const ctx = await sendableContext.call(this, cmd);
 if (!ctx) return;

 const t = await this.t(cmd.guild_id ?? undefined);
 const name = (findModalValue(cmd.data.components, 'name') || '').trim();
 const avatar = (findModalValue(cmd.data.components, 'avatar') || '').trim();
 const url = (findModalValue(cmd.data.components, 'url') || '').trim();

 if (url) {
  await sendToWebhookUrl.call(this, cmd, ctx.view, url, name || undefined, avatar || undefined);
  return;
 }

 const view: BuilderView = {
  ...ctx.view,
  marker: {
   execId: ctx.view.marker.execId,
   webhookName: name || undefined,
   webhookAvatar: avatar || undefined,
  },
 };

 if (buildMarkerUrl(view.marker).length > markerUrlLimit) {
  ephemeralNote.call(this, cmd, t.errors.webhookIdentityTooLong());
  return;
 }

 renderBuilder
  .call(this, t, view, sendRows.call(this, t, view, SendMode.Webhook))
  .update(cmd);
};

const resolveWebhook = async function (
 this: ComponentBuilderPlugin,
 api: API,
 channelId: string,
): Promise<{ id: string; token: string } | null> {
 const existing = await api.channels.getWebhooks(channelId, {
  origin: this.name,
  reason: 'Resolving webhook for components send',
 });

 if (!(existing instanceof RequestHandlerError)) {
  const own = existing.find((webhook) => webhook.token && webhook.application_id === api.botId);
  if (own?.token) return { id: own.id, token: own.token };
 }

 const created = await api.channels.createWebhook(
  channelId,
  { name: constants.standard.botName },
  { origin: this.name, reason: 'Creating webhook for components send' },
 );
 if (created instanceof RequestHandlerError || !created.token) return null;
 return { id: created.id, token: created.token };
};

export const webhookSendTo = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 if (cmd.data.component_type !== ComponentType.ChannelSelect) return;
 const ctx = await sendableContext.call(this, cmd);
 if (!ctx) return;

 const t = await this.t(cmd.guild_id);
 const api = await this.getAPI(cmd.guild_id);

 const failed: string[] = [];
 for (const channelId of cmd.data.values) {
  const webhook = await resolveWebhook.call(this, api, channelId);
  if (!webhook) {
   failed.push(channelId);
   continue;
  }

  const executed = await api.webhooks.execute(
   webhook.id,
   webhook.token,
   {
    components: ctx.view.tree,
    flags: MessageFlags.IsComponentsV2,
    username: ctx.view.marker.webhookName,
    avatar_url: ctx.view.marker.webhookAvatar,
    allowed_mentions: sendAllowedMentions,
    with_components: true,
   },
   { origin: this.name, reason: 'Sending built components via webhook' },
  );
  if (executed instanceof RequestHandlerError) failed.push(channelId);
 }

 await restoreBuilder.call(this, cmd, ctx.view);

 const sentCount = cmd.data.values.length - failed.length;
 const notes = [t.send.sent({ count: String(sentCount) })];
 failed.forEach((channelId) => notes.push(t.errors.noWebhook({ channel: `<#${channelId}>` })));
 await followUpNote.call(this, cmd, notes.join('\n'));
};

export const editOpen = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id) return;
 const ctx = await sendableContext.call(this, cmd);
 if (!ctx) return;

 const t = await this.t(cmd.guild_id);

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(ComponentBuilderRoute.EditMessageSubmit))
  .setTitle(t.edit.title().slice(0, 45))
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.edit.linkLabel())
    .setDescription(t.edit.linkHint())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId('link')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200)
      .setPlaceholder(constants.formatters.msgURL('xxx', 'xxx', 'xxx')),
    ),
  );

 const api = await this.getAPI(cmd.guild_id);
 api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening message edit modal',
 });
};

const editWebhookMessage = async function (
 this: ComponentBuilderPlugin,
 api: API,
 channelId: string,
 messageId: string,
 webhookId: string,
 view: BuilderView,
): Promise<boolean> {
 const webhooks = await api.channels.getWebhooks(channelId, {
  origin: this.name,
  reason: 'Resolving webhook for message edit',
 });
 if (webhooks instanceof RequestHandlerError) return false;

 const own = webhooks.find((webhook) => webhook.id === webhookId && webhook.token);
 if (!own?.token) return false;

 const edited = await api.webhooks.editMessage(
  own.id,
  own.token,
  messageId,
  {
   components: view.tree,
   flags: MessageFlags.IsComponentsV2,
   content: null,
   embeds: [],
   with_components: true,
  },
  { origin: this.name, reason: 'Editing webhook message with built components' },
 );
 return !(edited instanceof RequestHandlerError);
};

export const editSave = async function (
 this: ComponentBuilderPlugin,
 cmd: APIModalSubmitInteraction,
) {
 if (!cmd.guild_id) return;
 const ctx = await sendableContext.call(this, cmd);
 if (!ctx) return;

 const t = await this.t(cmd.guild_id);
 const link = findModalValue(cmd.data.components, 'link') || '';
 const match = link.match(messageLinkPattern);

 if (!match || match[1] !== cmd.guild_id) {
  ephemeralNote.call(this, cmd, t.errors.notALink());
  return;
 }

 const [, , channelId, messageId] = match;
 const api = await this.getAPI(cmd.guild_id);

 const message = await api.channels.getMessage(channelId, messageId, {
  origin: this.name,
  reason: 'Fetching message for components edit',
 });
 if (message instanceof RequestHandlerError) {
  ephemeralNote.call(this, cmd, t.base.errors.messageNotFound());
  return;
 }

 if (!((message.flags ?? 0) & MessageFlags.IsComponentsV2)) {
  ephemeralNote.call(this, cmd, t.errors.notComponentsV2());
  return;
 }

 if (message.webhook_id) {
  const ok = await editWebhookMessage.call(
   this,
   api,
   channelId,
   messageId,
   message.webhook_id,
   ctx.view,
  );
  ephemeralNote.call(this, cmd, ok ? t.edit.edited() : t.errors.notEditable());
  return;
 }

 if (message.author_id !== api.botId) {
  ephemeralNote.call(this, cmd, t.errors.notEditable());
  return;
 }

 const edited = await api.channels.editMessage(
  channelId,
  messageId,
  {
   components: ctx.view.tree,
   flags: MessageFlags.IsComponentsV2,
   content: null,
   embeds: [],
  },
  { origin: this.name, reason: 'Editing bot message with built components' },
 );
 ephemeralNote.call(
  this,
  cmd,
  edited instanceof RequestHandlerError ? t.base.errors.messageNotFound() : t.edit.edited(),
 );
};
