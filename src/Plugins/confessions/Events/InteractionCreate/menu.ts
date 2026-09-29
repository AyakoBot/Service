import {
 ConfessionState,
 type Confession as ConfessionRow,
 type ConfessionSetting,
} from '@ayako/database';
import {
 ComponentType,
 MessageFlags,
 type APIMessageComponentInteraction,
 type APIModalSubmitInteraction,
} from 'discord-api-types/v10';

import { findModalValue } from '../../../../Util/findModalValue.js';
import { MenuAction, reasonField } from '../../Classes/Routes.js';
import { actionPicker, banForm, deleteForm, reportForm } from '../../Util/forms.js';
import { IdentityError, isAuthorOf } from '../../Util/identity.js';
import { MenuPath, menuPath } from '../../Util/menu.js';
import { deferConfession, note } from '../../Util/respond.js';
import type ConfessionsPlugin from '../../Plugin.js';

type Translator = Awaited<ReturnType<ConfessionsPlugin['t']>>;

type MenuInteraction = APIMessageComponentInteraction | APIModalSubmitInteraction;

interface MenuTarget {
 settings: ConfessionSetting;
 confession: ConfessionRow;
 t: Translator;
 userId: string;
 identity: string;
}

const posted = [ConfessionState.Posted];
const reviewable = [ConfessionState.Pending, ConfessionState.Posted];

const routeOf = function (this: ConfessionsPlugin) {
 return (name: string, ...args: string[]) => this.getRoute(name, ...args);
};

const meta = { origin: 'Confessions', reason: 'Confession menu' };

const replyNow = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 content: string,
): Promise<void> {
 const api = await this.getAPI(cmd.guild_id ?? '');
 await api.interactions.reply(
  cmd.id,
  cmd.token,
  { content, flags: MessageFlags.Ephemeral, allowed_mentions: { parse: [] } },
  meta,
 );
};

const targetOf = async function (
 this: ConfessionsPlugin,
 cmd: MenuInteraction,
 confessionId: string,
 states: ConfessionState[],
): Promise<MenuTarget | string> {
 const t = await this.t(cmd.guild_id ?? '');
 const settings = cmd.guild_id ? await this.confessions.settings(cmd.guild_id) : null;
 if (!settings || !cmd.member) return t.errors.notEnabled();

 const confession = await this.confessions.byId(confessionId);
 if (!confession || !states.includes(confession.state)) return t.errors.gone();

 const userId = cmd.member.user.id;
 try {
  return { settings, confession, t, userId, identity: this.confessions.identityFor(settings, userId) };
 } catch (error) {
  return (error as Error).message === IdentityError.SecretMissing
   ? t.errors.secretMissing()
   : t.errors.failed();
 }
};

export const openMenu = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 confessionId: string,
): Promise<void> {
 const target = await targetOf.call(this, cmd, confessionId, posted);
 if (typeof target === 'string') {
  await replyNow.call(this, cmd, target);
  return;
 }

 const { settings, confession, t, userId, identity } = target;
 const api = await this.getAPI(settings.guild);
 const route = routeOf.call(this);
 const reply = Boolean(confession.parent);
 const path = menuPath(
  isAuthorOf(confession, identity, userId),
  this.confessions.reviewerAllowed(settings, cmd.member),
 );

 const paths: Record<MenuPath, () => Promise<unknown>> = {
  [MenuPath.Delete]: () =>
   api.interactions.createModal(cmd.id, cmd.token, deleteForm(t, route, confession.id, reply).toJSON(), meta),
  [MenuPath.Report]: () =>
   api.interactions.createModal(cmd.id, cmd.token, reportForm(t, route, confession.id, reply).toJSON(), meta),
  [MenuPath.Moderate]: () =>
   api.interactions.reply(
    cmd.id,
    cmd.token,
    {
     content: t.forms.pickerPrompt(),
     components: [actionPicker(t, route, confession.id).toJSON()],
     flags: MessageFlags.Ephemeral,
    },
    meta,
   ),
 };

 await paths[path]();
};

export const openBanForm = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 confessionId: string,
): Promise<void> {
 const target = await targetOf.call(this, cmd, confessionId, reviewable);
 if (typeof target === 'string') {
  await replyNow.call(this, cmd, target);
  return;
 }

 if (!this.confessions.reviewerAllowed(target.settings, cmd.member)) {
  await replyNow.call(this, cmd, target.t.errors.notReviewer());
  return;
 }

 const api = await this.getAPI(target.settings.guild);
 await api.interactions.createModal(
  cmd.id,
  cmd.token,
  banForm(target.t, routeOf.call(this), target.confession.id).toJSON(),
  meta,
 );
};

export const menuAction = async function (
 this: ConfessionsPlugin,
 cmd: APIMessageComponentInteraction,
 confessionId: string,
): Promise<void> {
 const choice = cmd.data.component_type === ComponentType.StringSelect ? cmd.data.values[0] : null;
 if (choice === MenuAction.Ban) {
  await openBanForm.call(this, cmd, confessionId);
  return;
 }

 const target = await targetOf.call(this, cmd, confessionId, posted);
 if (typeof target === 'string') {
  await replyNow.call(this, cmd, target);
  return;
 }

 const api = await this.getAPI(target.settings.guild);
 await api.interactions.createModal(
  cmd.id,
  cmd.token,
  reportForm(target.t, routeOf.call(this), target.confession.id, Boolean(target.confession.parent)).toJSON(),
  meta,
 );
};

export const reportSubmit = async function (
 this: ConfessionsPlugin,
 cmd: APIModalSubmitInteraction,
 confessionId: string,
): Promise<void> {
 await deferConfession.call(this, cmd);

 const target = await targetOf.call(this, cmd, confessionId, posted);
 if (typeof target === 'string') {
  await note.call(this, cmd, target);
  return;
 }

 const reason = findModalValue(cmd.data.components, reasonField)?.trim() ?? '';
 const failure = await this.moderation.report(target.settings, target.confession, target.userId, reason);

 await note.call(this, cmd, failure ?? target.t.menu.reported());
};

export const deleteSubmit = async function (
 this: ConfessionsPlugin,
 cmd: APIModalSubmitInteraction,
 confessionId: string,
): Promise<void> {
 await deferConfession.call(this, cmd);

 const target = await targetOf.call(this, cmd, confessionId, posted);
 if (typeof target === 'string') {
  await note.call(this, cmd, target);
  return;
 }

 const { settings, confession, t, userId, identity } = target;
 if (!isAuthorOf(confession, identity, userId)) {
  await note.call(this, cmd, t.errors.notAuthor());
  return;
 }

 const failure = await this.moderation.deleteByAuthor(settings, confession);
 await note.call(this, cmd, failure ?? (confession.parent ? t.menu.replyDeleted() : t.menu.deleted()));
};
