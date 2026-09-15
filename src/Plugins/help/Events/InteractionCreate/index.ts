import {
 InteractionType,
 PermissionFlagsBits,
 type APIApplicationCommandAutocompleteInteraction,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageComponentInteraction,
 type APIMessageComponentSelectMenuInteraction,
 type APIInteraction,
} from 'discord-api-types/v10';

import { RespondMode } from '../../../../Util/respondMode.js';
import { HelpCommand } from '../../Classes/Commands.js';
import { HelpScope } from '../../Classes/HelpTypes.js';
import { HelpRoute } from '../../Classes/Routes.js';
import type { SessionEntry } from '../../Classes/HelpSession.js';
import { contextFor } from '../../Util/context.js';
import { resolveCommand } from '../../Util/match.js';
import { respondNotice, respondPanel, type PanelView } from '../../Util/render.js';
import commandDetail from '../../Views/commandDetail.js';
import commandList from '../../Views/commandList.js';
import overview from '../../Views/overview.js';
import settingsList from '../../Views/settingsList.js';
import help, { autocomplete } from './command.js';
import plugins from './plugins.js';
import type HelpPlugin from '../../Plugin.js';

const hasManageGuild = (permissions?: string): boolean =>
 Boolean(
  permissions &&
  (BigInt(permissions) & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild,
 );

const parseRoute = (customId: string): { route: string; args: string[] } => {
 const [route, ...args] = customId.split('_');

 return { route: route ?? '', args };
};

const viewOf = (session: SessionEntry, ctx: Parameters<typeof commandDetail>[0]): PanelView => {
 if (session.scope === HelpScope.Settings) return settingsList(ctx);
 if (ctx.target) return commandDetail(ctx);
 if (session.paged) return commandList(ctx);

 return overview(ctx);
};

const sessionNotice = async function (this: HelpPlugin, cmd: APIInteraction): Promise<void> {
 const t = await this.t(cmd.guild_id ?? null);

 await respondNotice.call(this, cmd, t.panel.expired({ help: '`/help`' }));
};

const render = async function (
 this: HelpPlugin,
 cmd: APIInteraction,
 sessionId: string,
 requested: number | null,
): Promise<void> {
 const session = this.sessions.get(sessionId);
 if (!session) {
  await sessionNotice.call(this, cmd);
  return;
 }

 const page = requested ?? session.page;
 const next: SessionEntry = { ...session, page };
 this.sessions.update(sessionId, next);

 const ctx = await contextFor.call(this, cmd, sessionId, next.scope, next.path, page);

 await respondPanel.call(this, cmd, [viewOf(next, ctx).container], next.hide, RespondMode.Update);
};

const pageOf = (args: string[]): number | null => {
 const parsed = Number(args[1]);
 if (!Number.isFinite(parsed) || parsed < 1) return null;

 return Math.floor(parsed);
};

const pick = async function (
 this: HelpPlugin,
 cmd: APIMessageComponentSelectMenuInteraction,
 sessionId: string,
): Promise<void> {
 const session = this.sessions.get(sessionId);
 if (!session) {
  await sessionNotice.call(this, cmd);
  return;
 }

 const path = cmd.data.values[0] ?? '';
 const next: SessionEntry = { ...session, scope: HelpScope.Commands, path, page: 1 };
 this.sessions.update(sessionId, next);

 const data = await this.help.read(cmd);
 const resolved = resolveCommand(data.surface, path).target;
 const ctx = await contextFor.call(
  this,
  cmd,
  sessionId,
  HelpScope.Commands,
  resolved?.fullName ?? path,
  1,
 );

 await respondPanel.call(this, cmd, [viewOf(next, ctx).container], next.hide, RespondMode.Update);
};

const scope = async function (
 this: HelpPlugin,
 cmd: APIMessageComponentSelectMenuInteraction,
 sessionId: string,
): Promise<void> {
 const session = this.sessions.get(sessionId);
 if (!session) {
  await sessionNotice.call(this, cmd);
  return;
 }

 const chosen = cmd.data.values[0] === HelpScope.Settings ? HelpScope.Settings : HelpScope.Commands;
 const next: SessionEntry = { ...session, scope: chosen, path: null, page: 1 };
 this.sessions.update(sessionId, next);

 const ctx = await contextFor.call(this, cmd, sessionId, chosen, null, 1);

 await respondPanel.call(this, cmd, [viewOf(next, ctx).container], next.hide, RespondMode.Update);
};

const home = async function (
 this: HelpPlugin,
 cmd: APIInteraction,
 sessionId: string,
): Promise<void> {
 const session = this.sessions.get(sessionId);
 if (!session) {
  await sessionNotice.call(this, cmd);
  return;
 }

 const next: SessionEntry = {
  ...session,
  scope: HelpScope.Commands,
  path: null,
  page: 1,
 };
 this.sessions.update(sessionId, next);

 const ctx = await contextFor.call(this, cmd, sessionId, HelpScope.Commands, null, 1);

 await respondPanel.call(this, cmd, [viewOf(next, ctx).container], next.hide, RespondMode.Update);
};

const post = async function (
 this: HelpPlugin,
 cmd: APIMessageComponentInteraction,
 sessionId: string,
): Promise<void> {
 const t = await this.t(cmd.guild_id ?? null);

 if (!hasManageGuild(cmd.member?.permissions)) {
  await respondNotice.call(this, cmd, t.navigator.unavailable());
  return;
 }

 const session = this.sessions.get(sessionId);
 if (!session) {
  await sessionNotice.call(this, cmd);
  return;
 }

 const next: SessionEntry = { ...session, hide: false };
 const posted = this.sessions.create(next);
 const ctx = await contextFor.call(this, cmd, posted, next.scope, next.path, next.page);

 await respondPanel.call(this, cmd, [viewOf(next, ctx).container], false, RespondMode.Reply);
};

const componentHandlers: Partial<
 Record<
  HelpRoute,
  (this: HelpPlugin, cmd: APIMessageComponentInteraction, args: string[]) => unknown
 >
> = {
 [HelpRoute.Select]: function (cmd, args) {
  return pick.call(this, cmd as APIMessageComponentSelectMenuInteraction, args[0] ?? '');
 },
 [HelpRoute.Home]: function (cmd, args) {
  return home.call(this, cmd, args[0] ?? '');
 },
 [HelpRoute.Scope]: function (cmd, args) {
  return scope.call(this, cmd as APIMessageComponentSelectMenuInteraction, args[0] ?? '');
 },
 [HelpRoute.Page]: function (cmd, args) {
  return render.call(this, cmd, args[0] ?? '', pageOf(args));
 },
 [HelpRoute.Post]: function (cmd, args) {
  return post.call(this, cmd, args[0] ?? '');
 },
};

const dispatchComponent = async function (
 this: HelpPlugin,
 cmd: APIMessageComponentInteraction,
): Promise<void> {
 const { route, args } = parseRoute(cmd.data.custom_id);
 const handler = componentHandlers[route as HelpRoute];

 if (handler) await handler.call(this, cmd, args);
};

const dispatchCommand = async function (
 this: HelpPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
): Promise<void> {
 switch (cmd.data.name) {
  case HelpCommand.Help:
   await help.call(this, cmd);
   break;
  case HelpCommand.Plugins:
   await plugins.call(this, cmd);
   break;
  default:
   break;
 }
};

export default async function (this: HelpPlugin, cmd: APIInteraction): Promise<void> {
 switch (cmd.type) {
  case InteractionType.ApplicationCommand:
   await dispatchCommand.call(this, cmd as APIChatInputApplicationCommandInteraction);
   break;
  case InteractionType.ApplicationCommandAutocomplete:
   await autocomplete.call(this, cmd as APIApplicationCommandAutocompleteInteraction);
   break;
  case InteractionType.MessageComponent:
   await dispatchComponent.call(this, cmd as APIMessageComponentInteraction);
   break;
  default:
   break;
 }
}
