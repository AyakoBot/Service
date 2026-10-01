import { ComponentType, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type { BoundAction } from '../../Classes/ButtonBindings.js';
import { NodeAction } from '../../Classes/Nodes.js';
import { ComponentBuilderRoute } from '../../Classes/Routes.js';
import type ComponentBuilderPlugin from '../../Plugin.js';
import { builderContext, type BuilderView } from '../../Util/builderContext.js';
import {
 BuilderErrorCode,
 collectCustomIds,
 getNode,
 updateNode,
} from '../../Util/componentTree.js';
import { failNote } from '../../Util/failNote.js';
import { isBindable } from '../../Util/nodeActions.js';
import { lastNodePage, NodePageNav, nodePageSize, stepNodePage } from '../../Util/nodePaging.js';
import { presentBuilder } from '../../Util/presentBuilder.js';
import { bindRows, type BindStep } from '../../Util/renderBind.js';

type System = BoundAction['system'];

const isPageNav = (value: string): value is NodePageNav =>
 (Object.values(NodePageNav) as string[]).includes(value);

const pickedValue = (cmd: APIMessageComponentInteraction): string | undefined =>
 (cmd.data.component_type === ComponentType.StringSelect ? cmd.data.values[0] : undefined);

const showStep = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
 step: BindStep,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 await presentBuilder.call(this, cmd, view.tree, view, bindRows.call(this, t, view, step));
};

const bindableView = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 path: string,
): Promise<BuilderView | null> {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return null;

 const node = getNode(ctx.view.tree, path);
 if (!node || !isBindable(node)) {
  await failNote.call(this, cmd, BuilderErrorCode.NotAllowedHere);
  return null;
 }

 return { ...ctx.view, selectedPath: path };
};

const liveAction = function (
 this: ComponentBuilderPlugin,
 guildId: string,
 route: string | undefined,
): BoundAction | null {
 const bound = route ? this.bindings.action(route) : null;
 return bound && this.bindings.system(guildId, bound.system.settingName) ? bound : null;
};

const reopenRoute = function (this: ComponentBuilderPlugin, path: string): string {
 return this.getRoute(ComponentBuilderRoute.Action, NodeAction.Bind, path);
};

const finish = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
 customId: string,
) {
 const path = view.selectedPath ?? '';
 const result = updateNode(view.tree, path, (node) => {
  if (!isBindable(node)) return BuilderErrorCode.NotAllowedHere;
  if (collectCustomIds(view.tree, path).includes(customId)) return BuilderErrorCode.CustomIdTaken;
  node.custom_id = customId;
  return null;
 });

 if (!result.ok) {
  await failNote.call(this, cmd, result.error);
  return;
 }

 await presentBuilder.call(this, cmd, view.tree, { ...view, tree: result.tree });
};

const showChoices = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
 bound: BoundAction,
 page: number,
) {
 const guildId = cmd.guild_id ?? '';
 const path = view.selectedPath ?? '';
 const t = await this.t(guildId);
 const choices = await this.bindings.choices(guildId, bound);
 const last = lastNodePage(choices.length);
 const shown = Math.min(Math.max(page, 0), last);
 const nav = (label: string, value: NodePageNav) => ({ label, value });

 const options = [
  ...(shown > 0 ? [nav(t.builder.previousPage(), NodePageNav.Previous)] : []),
  ...choices.slice(shown * nodePageSize, (shown + 1) * nodePageSize),
  ...(shown < last ? [nav(t.builder.nextPage(), NodePageNav.Next)] : []),
 ];
 const several = (bound.system.buttonActions?.length ?? 0) > 1;

 await showStep.call(this, cmd, view, {
  prompt: t.bind.choice({ action: await bound.action.label(guildId) }),
  customId: this.getRoute(ComponentBuilderRoute.BindChoice, path, bound.action.route, shown),
  options: choices.length ? options : [],
  back: several
   ? this.getRoute(ComponentBuilderRoute.BindSystem, path, bound.system.settingName)
   : reopenRoute.call(this, path),
 });
};

const pickAction = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
 bound: BoundAction,
) {
 if (!bound.action.choices) {
  await finish.call(this, cmd, view, this.bindings.customId(bound));
  return;
 }

 await showChoices.call(this, cmd, view, bound, 0);
};

const showActions = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
 system: System,
) {
 const actions = system.buttonActions ?? [];
 if (actions.length === 1) {
  await pickAction.call(this, cmd, view, { system, action: actions[0] });
  return;
 }

 const guildId = cmd.guild_id ?? '';
 const t = await this.t(guildId);
 const options = await Promise.all(
  actions.map(async (action) => ({ label: await action.label(guildId), value: action.route })),
 );

 await showStep.call(this, cmd, view, {
  prompt: t.bind.action({ system: system.name }),
  customId: this.getRoute(ComponentBuilderRoute.BindAction, view.selectedPath ?? ''),
  options,
  back: reopenRoute.call(this, view.selectedPath ?? ''),
 });
};

export const openBind = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 const systems = this.bindings.systems(cmd.guild_id ?? '');

 await showStep.call(this, cmd, view, {
  prompt: t.bind.system(),
  customId: this.getRoute(ComponentBuilderRoute.BindSystem, view.selectedPath ?? ''),
  options: systems.map((system) => ({ label: system.name, value: system.settingName })),
 });
};

export const bindSystem = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const [path = '', argSystem] = args;
 const view = await bindableView.call(this, cmd, path);
 if (!view) return;

 const settingName = argSystem ?? pickedValue(cmd);
 const system = settingName ? this.bindings.system(cmd.guild_id ?? '', settingName) : null;
 if (!system) {
  await failNote.call(this, cmd, BuilderErrorCode.NotAllowedHere);
  return;
 }

 await showActions.call(this, cmd, view, system);
};

export const bindAction = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const [path = ''] = args;
 const view = await bindableView.call(this, cmd, path);
 if (!view) return;

 const bound = liveAction.call(this, cmd.guild_id ?? '', pickedValue(cmd));
 if (!bound) {
  await failNote.call(this, cmd, BuilderErrorCode.NotAllowedHere);
  return;
 }

 await pickAction.call(this, cmd, view, bound);
};

export const bindChoice = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const [path = '', route, page] = args;
 const view = await bindableView.call(this, cmd, path);
 if (!view) return;

 const bound = liveAction.call(this, cmd.guild_id ?? '', route);
 const value = pickedValue(cmd);
 if (!bound || !value) {
  await failNote.call(this, cmd, BuilderErrorCode.NotAllowedHere);
  return;
 }

 if (isPageNav(value)) {
  await showChoices.call(this, cmd, view, bound, stepNodePage(Number(page) || 0, value));
  return;
 }

 await finish.call(this, cmd, view, this.bindings.customId(bound, value));
};
