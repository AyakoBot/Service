import { RequestHandlerError } from '@ayako/api';
import { LabelBuilder, ModalBuilder, TextInputBuilder } from '@discordjs/builders';
import {
 ConfessionState,
 type Confession as ConfessionRow,
 type ConfessionSetting,
} from '@ayako/database';
import {
 MessageFlags,
 TextInputStyle,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import { findModalValue } from '../../../../Util/findModalValue.js';
import parseDuration from '../../../../Util/parseDuration.js';
import { ConfessionsRoute, durationField, reasonField } from '../../Classes/Routes.js';
import { buildResolved } from '../../Util/container.js';
import { canReveal } from '../../Util/identity.js';
import { ConfessionLogKind } from '../../Util/logContainer.js';
import { deferConfession, note } from '../../Util/respond.js';
import type ConfessionsPlugin from '../../Plugin.js';

const origin = 'Confessions';

type Translator = Awaited<ReturnType<ConfessionsPlugin['t']>>;

interface ReviewContext {
 settings: ConfessionSetting;
 confession: ConfessionRow;
 t: Translator;
 actor: string;
 by: string;
}

const userMention = (userId: string): string => '<@' + userId + '>';

const load = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction | APIModalSubmitInteraction,
 confessionId: string,
): Promise<ReviewContext | null> {
 if (!cmd.guild_id || !cmd.member) return null;

 const t = await this.t(cmd.guild_id);
 const settings = await this.confessions.settings(cmd.guild_id);
 if (!settings) {
  await note.call(this, cmd, t.errors.notEnabled());
  return null;
 }

 if (!this.confessions.reviewerAllowed(settings, cmd.member)) {
  await note.call(this, cmd, t.errors.notReviewer());
  return null;
 }

 const confession = await this.confessions.byId(confessionId);
 if (!confession) {
  await note.call(this, cmd, t.errors.gone());
  return null;
 }

 const actor = cmd.member.user.id;

 return { settings, confession, t, actor, by: userMention(actor) };
};

const patchQueue = async function (
 this: ConfessionsPlugin,
 ctx: ReviewContext,
 verdict: string,
 unban: boolean,
): Promise<void> {
 const { confession, settings, t } = ctx;
 if (!confession.queueChannel || !confession.queueMessage) return;

 const api = await this.getAPI(settings.guild);
 const res = await api.channels.editMessage(
  confession.queueChannel,
  confession.queueMessage,
  {
   flags: MessageFlags.IsComponentsV2,
   components: buildResolved(
    t,
    {
     confessionId: confession.id,
     parentNumber: await this.moderation.parentNumber(confession),
     number: confession.number,
     numbered: settings.numbered,
     content: confession.content ?? '',
     media: confession.media,
     anonymity: settings.anonymity,
     screened: null,
    },
    verdict,
    unban,
    (route, ...args) => this.getRoute(route, ...args),
   ),
  },
  { origin, reason: 'Confession resolved' },
 );

 if (res instanceof RequestHandlerError) this.nonFatalError(res, 'patchQueue');
};

export const approve = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 confessionId: string,
): Promise<void> {
 await deferConfession.call(this, cmd);

 const ctx = await load.call(this, cmd, confessionId);
 if (!ctx) return;

 const { confession, settings, t, by } = ctx;
 if (!(await this.confessions.claim(confession.id))) {
  await note.call(this, cmd, t.errors.alreadyHandled());
  return;
 }

 const failure = await this.publisher.publish(settings, confession, ctx.actor);
 if (failure) {
  await this.confessions.release(confession.id);
  await note.call(this, cmd, failure);
  return;
 }

 const verdict = t.review.approved({ user: by });

 await patchQueue.call(this, ctx, verdict, false);
 await note.call(this, cmd, verdict);
};

export const denyModal = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 confessionId: string,
): Promise<void> {
 if (!cmd.guild_id) return;

 const t = await this.t(cmd.guild_id);
 const modal = new ModalBuilder()
  .setCustomId(this.getRoute(ConfessionsRoute.DenyModal, confessionId))
  .setTitle(t.modal.denyTitle())
  .addLabelComponents(
   new LabelBuilder()
    .setLabel(t.modal.reasonLabel())
    .setTextInputComponent(
     new TextInputBuilder()
      .setCustomId(reasonField)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000),
    ),
  );

 const api = await this.getAPI(cmd.guild_id);
 await api.interactions.createModal(cmd.id, cmd.token, modal.toJSON(), {
  origin,
  reason: 'Opening confession rejection modal',
 });
};

const notifyAuthor = async function (
 this: ConfessionsPlugin,
 ctx: ReviewContext,
 reason: string,
): Promise<void> {
 const { confession, settings, t } = ctx;
 if (!confession.author) return;

 const api = await this.getAPI(settings.guild);
 const dm = await api.users.createDM(confession.author, { origin, reason: 'Confession rejected' });
 if (dm instanceof RequestHandlerError) return;

 const guild = await this.client.cache.guilds.get(settings.guild);
 const guildName = guild?.name ?? settings.guild;
 const wording = confession.parent
  ? { plain: t.dm.replyDenied, reasoned: t.dm.replyDeniedWithReason }
  : { plain: t.dm.denied, reasoned: t.dm.deniedWithReason };
 const content = reason
  ? wording.reasoned({ guild: guildName, reason })
  : wording.plain({ guild: guildName });

 await new MessagePayload(this.client, { origin, reason: 'Confession rejected' })
  .setAPI(api)
  .setContent(content)
  .setSendTo([{ channel: dm.id, guildId: '@me' }])
  .send();
};

export const deny = async function (
 this: ConfessionsPlugin,
 cmd: APIModalSubmitInteraction,
 confessionId: string,
): Promise<void> {
 await deferConfession.call(this, cmd);

 const ctx = await load.call(this, cmd, confessionId);
 if (!ctx) return;

 const { confession, settings, t, by } = ctx;
 const reason = findModalValue(cmd.data.components, reasonField) ?? '';
 const rejected = t.review.denied({ user: by });
 const verdict = reason ? rejected + ' ' + t.review.denialReason({ reason }) : rejected;

 if (!(await this.confessions.reject(confession.id))) {
  await note.call(this, cmd, t.errors.alreadyHandled());
  return;
 }

 await patchQueue.call(this, ctx, verdict, false);
 await notifyAuthor.call(this, ctx, reason);
 await this.confessionLog.record(settings, {
  kind: ConfessionLogKind.Rejected,
  number: confession.number,
  parentNumber: await this.moderation.parentNumber(confession),
  author: confession.author,
  actor: ctx.actor,
  content: confession.content,
  reason: reason || null,
 });
 await note.call(this, cmd, verdict);
};

export const banSubmit = async function (
 this: ConfessionsPlugin,
 cmd: APIModalSubmitInteraction,
 confessionId: string,
): Promise<void> {
 await deferConfession.call(this, cmd);

 const ctx = await load.call(this, cmd, confessionId);
 if (!ctx) return;

 const { confession, settings, t, by } = ctx;
 const duration = parseDuration(findModalValue(cmd.data.components, durationField) ?? '');
 if (duration === null) {
  await note.call(this, cmd, t.errors.invalidDuration());
  return;
 }

 const until = duration > 0 ? new Date(Date.now() + duration) : null;
 const reason = findModalValue(cmd.data.components, reasonField)?.trim() || null;

 await this.moderation.ban({ settings, confession, actor: ctx.actor, reason, until });

 if (confession.state === ConfessionState.Pending && (await this.confessions.reject(confession.id))) {
  await patchQueue.call(this, ctx, t.review.banned({ user: by }), true);
 }

 await note.call(
  this,
  cmd,
  until
   ? t.menu.bannedUntil({ time: constants.formatters.getTime(until.getTime()) })
   : t.menu.bannedPermanently(),
 );
};

export const unban = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 confessionId: string,
): Promise<void> {
 await deferConfession.call(this, cmd);

 const ctx = await load.call(this, cmd, confessionId);
 if (!ctx) return;

 const { confession, settings, t, by } = ctx;
 await this.moderation.unban(settings, confession.identity, ctx.actor);

 const verdict = t.review.unbanned({ user: by });

 await patchQueue.call(this, ctx, verdict, false);
 await note.call(this, cmd, verdict);
};

export const reveal = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 confessionId: string,
): Promise<void> {
 await deferConfession.call(this, cmd);

 const ctx = await load.call(this, cmd, confessionId);
 if (!ctx) return;

 const { confession, settings, t } = ctx;

 if (!canReveal(settings.anonymity) || !confession.author) {
  await note.call(this, cmd, t.errors.revealUnavailable());
  return;
 }

 await this.confessionLog.record(settings, {
  kind: ConfessionLogKind.Revealed,
  number: confession.number,
  parentNumber: await this.moderation.parentNumber(confession),
  author: confession.author,
  actor: ctx.actor,
 });

 const revealed = t.review.revealed({ user: confession.author });

 await note.call(this, cmd, `${revealed}
-# ${t.review.revealLogged()}`);
};
