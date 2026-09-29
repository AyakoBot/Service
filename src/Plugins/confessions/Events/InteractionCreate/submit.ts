import { randomUUID } from 'node:crypto';

import { RequestHandlerError } from '@ayako/api';
import { LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import {
 ConfessionAnonymity,
 ConfessionMode,
 ConfessionState,
 type Confession as ConfessionRow,
 type ConfessionSetting,
} from '@ayako/database';
import {
 MessageFlags,
 TextInputStyle,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { findModalValue } from '../../../../Util/findModalValue.js';
import { ConfessionsRoute, contentField, mediaField } from '../../Classes/Routes.js';
import { anonymityNote, buildReview } from '../../Util/container.js';
import {
 GateFailure,
 checkGates,
 lengthBounds,
 snowflakeCreatedAt,
 type LengthBounds,
} from '../../Util/gates.js';
import { IdentityError, authorFor } from '../../Util/identity.js';
import { isImageLink } from '../../Util/media.js';
import { deferConfession, note } from '../../Util/respond.js';
import type ConfessionsPlugin from '../../Plugin.js';

type Translator = Awaited<ReturnType<ConfessionsPlugin['t']>>;

interface Intake {
 settings: ConfessionSetting;
 identity: string;
 author: string | null;
 content: string;
 media: string | null;
 reply: boolean;
}

export const mediaAllowed = (settings: ConfessionSetting): boolean =>
 settings.allowMedia && settings.anonymity === ConfessionAnonymity.Unmaskable;

export const contentLabel = (
 t: Translator,
 settings: ConfessionSetting,
 bounds: LengthBounds,
): LabelBuilder =>
 new LabelBuilder()
  .setLabel(t.modal.contentLabel())
  .setDescription(anonymityNote(t, settings.anonymity))
  .setTextInputComponent(
   new TextInputBuilder()
    .setCustomId(contentField)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(bounds.min)
    .setMaxLength(bounds.max)
    .setPlaceholder(t.modal.contentPlaceholder()),
  );

export const mediaLabel = (t: Translator): LabelBuilder =>
 new LabelBuilder()
  .setLabel(t.modal.mediaLabel())
  .setTextInputComponent(
   new TextInputBuilder()
    .setCustomId(mediaField)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(2048)
    .setPlaceholder(t.modal.mediaPlaceholder()),
  );

export const openModal = async function (
 this: ConfessionsPlugin,
 cmd: APIChatInputApplicationCommandInteraction | APIMessageComponentInteraction,
): Promise<void> {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);
 const settings = await this.confessions.settings(cmd.guild_id);
 const api = await this.getAPI(cmd.guild_id);

 if (!settings?.channel) {
  await api.interactions.reply(
   cmd.id,
   cmd.token,
   { content: t.errors.notEnabled(), flags: MessageFlags.Ephemeral },
   { origin: this.name, reason: 'Confessions not configured' },
  );
  return;
 }

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(ConfessionsRoute.SubmitModal))
  .setTitle(t.modal.title())
  .addLabelComponents(
   contentLabel(t, settings, lengthBounds(settings.minLength, settings.maxLength)),
  );

 if (mediaAllowed(settings)) modal.addLabelComponents(mediaLabel(t));

 await api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening confession modal',
 });
};

export const openReplyModal = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 parentId: string,
): Promise<void> {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);
 const settings = await this.confessions.settings(cmd.guild_id);
 const parent = await this.confessions.byId(parentId);
 const api = await this.getAPI(cmd.guild_id);

 if (!settings?.channel || !parent || parent.state !== ConfessionState.Posted) {
  await api.interactions.reply(
   cmd.id,
   cmd.token,
   {
    content: settings?.channel ? t.errors.gone() : t.errors.notEnabled(),
    flags: MessageFlags.Ephemeral,
   },
   { origin: this.name, reason: 'Confession reply unavailable' },
  );
  return;
 }

 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(ConfessionsRoute.ReplyModal, parent.id))
  .setTitle(
   parent.number === null
    ? t.modal.replyTitlePlain()
    : t.modal.replyTitle({ number: String(parent.number) }),
  )
  .addLabelComponents(
   contentLabel(t, settings, lengthBounds(settings.minLength, settings.maxLength)),
  );

 if (mediaAllowed(settings)) modal.addLabelComponents(mediaLabel(t));

 await api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin: this.name,
  reason: 'Opening confession reply modal',
 });
};

const failureMessage = (t: Translator, failure: GateFailure): string => {
 const messages: Record<GateFailure, () => string> = {
  [GateFailure.Banned]: t.errors.banned,
  [GateFailure.Blocked]: t.errors.blocked,
  [GateFailure.AccountTooNew]: t.errors.accountTooNew,
  [GateFailure.MemberTooNew]: t.errors.memberTooNew,
  [GateFailure.Cooldown]: t.errors.cooldown,
  [GateFailure.TooShort]: t.errors.tooShort,
  [GateFailure.TooLong]: t.errors.tooLong,
  [GateFailure.InvalidMedia]: t.errors.invalidMedia,
  [GateFailure.DailyLimit]: t.errors.dailyLimit,
 };

 return messages[failure]();
};

const identityOf = function (
 this: ConfessionsPlugin,
 settings: ConfessionSetting,
 userId: string,
 t: Translator,
): string | { error: string } {
 try {
  return this.confessions.identityFor(settings, userId);
 } catch (error) {
  return {
   error:
    (error as Error).message === IdentityError.SecretMissing
     ? t.errors.secretMissing()
     : t.errors.failed(),
  };
 }
};

const readIntake = async function (
 this: ConfessionsPlugin,
 cmd: APIModalSubmitInteraction,
 t: Translator,
 reply: boolean,
): Promise<Intake | string> {
 const settings = cmd.guild_id ? await this.confessions.settings(cmd.guild_id) : null;
 if (!settings?.channel || !cmd.member) return t.errors.notEnabled();

 const userId = cmd.member.user.id;
 const identity = identityOf.call(this, settings, userId, t);
 if (typeof identity !== 'string') return identity.error;

 const content = findModalValue(cmd.data.components, contentField) ?? '';
 const media = mediaAllowed(settings)
  ? findModalValue(cmd.data.components, mediaField)?.trim() || null
  : null;
 const bounds = lengthBounds(settings.minLength, settings.maxLength);

 const failure = checkGates({
  now: Date.now(),
  banned: await this.confessions.isBanned(settings.guild, identity, userId),
  blocked: this.confessions.blocked(settings, userId, cmd.member.roles),
  accountCreated: snowflakeCreatedAt(userId),
  memberJoined: cmd.member.joined_at ? new Date(cmd.member.joined_at).getTime() : Date.now(),
  minAccountAge: Number(settings.minAccountAge),
  minMemberAge: Number(settings.minMemberAge),
  onCooldown: await this.schedule.onCooldown(settings.guild, identity),
  length: content.length,
  minLength: bounds.min,
  maxLength: bounds.max,
  mediaValid: media === null || isImageLink(media),
  recentCount: reply ? 0 : await this.confessions.recentCount(settings.guild, identity),
  maxPerDay: reply ? 0 : settings.maxPerDay,
 });
 if (failure) return failureMessage(t, failure);

 return {
  settings,
  identity,
  author: authorFor(settings.anonymity, userId),
  content,
  media,
  reply,
 };
};

const queueForReview = async function (
 this: ConfessionsPlugin,
 settings: ConfessionSetting,
 confession: ConfessionRow,
 screened: string | null,
): Promise<string | null> {
 const t = await this.t(settings.guild);
 if (!settings.reviewChannel) return t.errors.noReviewChannel();

 const payload = new MessagePayload(this.client, { origin: this.name, reason: 'Confession review' })
  .setFlags(MessageFlags.IsComponentsV2)
  .setComponents(
   buildReview(
    t,
    {
     confessionId: confession.id,
     parentNumber: await this.moderation.parentNumber(confession),
     number: null,
     numbered: settings.numbered,
     content: confession.content ?? '',
     media: confession.media,
     anonymity: settings.anonymity,
     screened,
    },
    (route, ...args) => this.getRoute(route, ...args),
   ),
  );

 const api = await this.getAPI(settings.guild);
 const message = await api.channels.createMessage(settings.reviewChannel, payload.getAPIPayload(), {
  origin: this.name,
  reason: 'Confession awaiting review',
 });

 if (message instanceof RequestHandlerError) {
  this.nonFatalError(message, 'queueForReview');
  return t.errors.queueFailed({
   channel: `<#${settings.reviewChannel}>`,
   error: message.errorMessage ?? t.base.errors.unknownError(),
  });
 }

 await this.client.db.client.confession.update({
  where: { id: confession.id },
  data: { queueChannel: settings.reviewChannel, queueMessage: message.id },
 });

 return null;
};

const dispatch = async function (
 this: ConfessionsPlugin,
 t: Translator,
 intake: Intake,
 confession: ConfessionRow,
 screened: string | null,
): Promise<string> {
 const { settings, identity } = intake;

 if (settings.mode === ConfessionMode.Review || screened) {
  const failure = await queueForReview.call(this, settings, confession, screened);
  if (failure) {
   await this.confessions.discard(confession.id);
   return failure;
  }

  await this.schedule.armCooldown(settings, identity);
  return intake.reply ? t.submitted.replyQueued() : t.submitted.queued();
 }

 const jitter = Number(settings.postJitter);
 if (jitter > 0) {
  await this.schedule.armPost(confession.id, Math.ceil(Math.random() * jitter));
  await this.schedule.armCooldown(settings, identity);
  return intake.reply ? t.submitted.replyDelayed() : t.submitted.delayed();
 }

 const failure = await this.publisher.publish(settings, confession);
 if (failure) {
  await this.confessions.discard(confession.id);
  return failure;
 }

 await this.schedule.armCooldown(settings, identity);
 return intake.reply ? t.submitted.replyPosted() : t.submitted.posted();
};

const enter = async function (
 this: ConfessionsPlugin,
 cmd: APIModalSubmitInteraction,
 t: Translator,
 parent: string | null,
): Promise<string> {
 const intake = await readIntake.call(this, cmd, t, parent !== null);
 if (typeof intake === 'string') return intake;

 const screened =
  intake.settings.mode === ConfessionMode.Screened
   ? await this.confessions.screen(
      intake.settings,
      [intake.content, intake.media].filter(Boolean).join('\n'),
     )
   : null;

 const confession = await this.client.db.client.confession.create({
  data: {
   id: randomUUID(),
   guild: intake.settings.guild,
   parent,
   state: ConfessionState.Pending,
   content: intake.content,
   media: intake.media,
   identity: intake.identity,
   author: intake.author,
  },
 });

 return dispatch.call(this, t, intake, confession, screened);
};

export const submit = async function (
 this: ConfessionsPlugin,
 cmd: APIModalSubmitInteraction,
): Promise<void> {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);
 await deferConfession.call(this, cmd);
 await note.call(this, cmd, await enter.call(this, cmd, t, null));
};

export const submitReply = async function (
 this: ConfessionsPlugin,
 cmd: APIModalSubmitInteraction,
 parentId: string,
): Promise<void> {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);
 await deferConfession.call(this, cmd);

 const parent = await this.confessions.byId(parentId);
 if (!parent || parent.state !== ConfessionState.Posted) {
  await note.call(this, cmd, t.errors.gone());
  return;
 }

 await note.call(this, cmd, await enter.call(this, cmd, t, parent.id));
};
