import {
 ButtonStyle,
 ComponentType,
 SeparatorSpacingSize,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import { MediaAddKind, NodeAction, NodeKind } from '../../Classes/Nodes.js';
import type ComponentBuilderPlugin from '../../Plugin.js';
import {
 defaultPosition,
 insertAtTarget,
 normalizeTarget,
 parseAddTarget,
 type AddTarget,
} from '../../Util/addTarget.js';
import { builderContext, type BuilderView } from '../../Util/builderContext.js';
import {
 BuilderErrorCode,
 getNode,
 makeButton,
 makeContainer,
 makeEntitySelect,
 makeSectionWithButton,
 makeSeparator,
 makeStringSelect,
 makeText,
 moveNode,
 nextCustomId,
 removeNode,
 setAccessory,
 updateNode,
 type TreeResult,
 type WipNode,
 type WipTree,
 flattenTree,
} from '../../Util/componentTree.js';
import { failNote } from '../../Util/failNote.js';
import { movedSelection, moveUnit, offersAction, styleOptions } from '../../Util/nodeActions.js';
import { NodePageNav, shownNodePage, stepNodePage } from '../../Util/nodePaging.js';
import { presentBuilder } from '../../Util/presentBuilder.js';
import { addRows, styleRows } from '../../Util/renderBuilder.js';

import { openBind } from './bindFlow.js';
import { openEditModal, openMediaModal, openOptionsModal } from './editorModal.js';

type Translator = Awaited<ReturnType<ComponentBuilderPlugin['t']>>;

type Opener = (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
) => Promise<void>;

interface NodeChange {
 result: TreeResult;
 selectedPath?: string | null;
}

type Change = (t: Translator, tree: WipTree, path: string) => NodeChange;

export const nodePick = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const [value] = cmd.data.values;
 if (value === NodePageNav.Previous || value === NodePageNav.Next) {
  const entries = flattenTree(ctx.view.tree);
  const shown = shownNodePage(entries, ctx.view.selectedPath, ctx.view.nodePage);
  await presentBuilder.call(this, cmd, ctx.view.tree, {
   ...ctx.view,
   selectedPath: null,
   nodePage: stepNodePage(shown, value),
  });
  return;
 }

 const selectedPath = value && getNode(ctx.view.tree, value) ? value : null;
 await presentBuilder.call(this, cmd, ctx.view.tree, { ...ctx.view, selectedPath });
};

const toggleNode = (tree: WipTree, path: string, action: NodeAction): TreeResult =>
 updateNode(tree, path, (node) => {
  switch (action) {
   case NodeAction.ToggleDivider:
    if (node.type !== ComponentType.Separator) return BuilderErrorCode.NotAllowedHere;
    node.divider = node.divider === false;
    return null;
   case NodeAction.ToggleSpacing:
    if (node.type !== ComponentType.Separator) return BuilderErrorCode.NotAllowedHere;
    node.spacing =
     node.spacing === SeparatorSpacingSize.Large
      ? SeparatorSpacingSize.Small
      : SeparatorSpacingSize.Large;
    return null;
   case NodeAction.ToggleSpoiler:
    if (node.type !== ComponentType.Container && node.type !== ComponentType.Thumbnail) {
     return BuilderErrorCode.NotAllowedHere;
    }
    node.spoiler = !node.spoiler;
    return null;
   case NodeAction.ToggleDisabled: {
    switch (node.type) {
     case ComponentType.Button:
     case ComponentType.StringSelect:
     case ComponentType.UserSelect:
     case ComponentType.RoleSelect:
     case ComponentType.ChannelSelect:
     case ComponentType.MentionableSelect:
      node.disabled = !node.disabled;
      return null;
     default:
      return BuilderErrorCode.NotAllowedHere;
    }
   }
   default:
    return BuilderErrorCode.NotAllowedHere;
  }
 });

const linkPlaceholderUrl = 'https://ayakobot.com/';

const setButtonStyle = (tree: WipTree, path: string, style: ButtonStyle): TreeResult =>
 updateNode(tree, path, (node) => {
  if (node.type !== ComponentType.Button || 'sku_id' in node) {
   return BuilderErrorCode.NotAllowedHere;
  }

  const raw = node as unknown as Record<string, unknown>;
  if (style === ButtonStyle.Link) {
   if (!('url' in node)) {
    delete raw.custom_id;
    raw.url = linkPlaceholderUrl;
   }
  } else if (!('custom_id' in node)) {
   delete raw.url;
   raw.custom_id = nextCustomId(tree, 'button');
  }

  raw.style = style;
  return null;
 });

const addedNode = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 tree: WipTree,
 action: NodeAction,
): WipNode | null {
 switch (action) {
  case NodeAction.AddText:
   return makeText(t.defaults.text());
  case NodeAction.AddSeparator:
   return makeSeparator();
  case NodeAction.AddContainer:
   return makeContainer(t.defaults.text());
  case NodeAction.AddSectionButton:
   return makeSectionWithButton(
    t.defaults.text(),
    nextCustomId(tree, 'button'),
    t.defaults.buttonLabel(),
   );
  case NodeAction.AddButton:
   return makeButton(nextCustomId(tree, 'button'), t.defaults.buttonLabel());
  case NodeAction.AddStringSelect:
   return makeStringSelect(nextCustomId(tree, 'select'), t.defaults.optionLabel());
  case NodeAction.AddUserSelect:
   return makeEntitySelect(NodeKind.UserSelect, nextCustomId(tree, 'select'));
  case NodeAction.AddRoleSelect:
   return makeEntitySelect(NodeKind.RoleSelect, nextCustomId(tree, 'select'));
  case NodeAction.AddChannelSelect:
   return makeEntitySelect(NodeKind.ChannelSelect, nextCustomId(tree, 'select'));
  case NodeAction.AddMentionableSelect:
   return makeEntitySelect(NodeKind.MentionableSelect, nextCustomId(tree, 'select'));
  default:
   return null;
 }
};

const moveChange = (tree: WipTree, path: string, offset: -1 | 1): NodeChange => ({
 result: moveNode(tree, moveUnit(tree, path), offset),
 selectedPath: movedSelection(tree, path, offset),
});

const toggleChange =
 (action: NodeAction): Change =>
 (_t, tree, path) => ({ result: toggleNode(tree, path, action) });

const nodeChanges: Partial<Record<NodeAction, Change>> = {
 [NodeAction.MoveUp]: (_t, tree, path) => moveChange(tree, path, -1),
 [NodeAction.MoveDown]: (_t, tree, path) => moveChange(tree, path, 1),
 [NodeAction.Remove]: (_t, tree, path) => ({
  result: removeNode(tree, path),
  selectedPath: null,
 }),
 [NodeAction.ToggleDivider]: toggleChange(NodeAction.ToggleDivider),
 [NodeAction.ToggleSpacing]: toggleChange(NodeAction.ToggleSpacing),
 [NodeAction.ToggleSpoiler]: toggleChange(NodeAction.ToggleSpoiler),
 [NodeAction.ToggleDisabled]: toggleChange(NodeAction.ToggleDisabled),
 [NodeAction.AccessoryButton]: (t, tree, path) => ({
  result: setAccessory(
   tree,
   path,
   makeButton(nextCustomId(tree, 'button'), t.defaults.buttonLabel()),
  ),
 }),
};

const changeFor = (action: NodeAction): Change | undefined => {
 const style = styleOptions.find((option) => option.action === action)?.style;
 if (style === undefined) return nodeChanges[action];
 return (_t, tree, path) => ({ result: setButtonStyle(tree, path, style) });
};

const presentAdd = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
 target: AddTarget,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 const adding = normalizeTarget(view.tree, target);
 await presentBuilder.call(this, cmd, view.tree, view, addRows.call(this, t, view, adding));
};

const openAdd: Opener = async function (cmd, view) {
 await presentAdd.call(this, cmd, view, {
  position: defaultPosition(view.tree, view.selectedPath),
  selectedPath: view.selectedPath,
 });
};

const openStyle: Opener = async function (cmd, view) {
 if (!view.selectedPath) return;
 const t = await this.t(cmd.guild_id ?? undefined);
 await presentBuilder.call(
  this,
  cmd,
  view.tree,
  view,
  styleRows.call(this, t, view, view.selectedPath),
 );
};

const openAccessoryThumbnail: Opener = async function (cmd) {
 await openMediaModal.call(this, cmd, MediaAddKind.AccessoryThumbnail);
};

const openers: Partial<Record<NodeAction, Opener>> = {
 [NodeAction.Edit]: openEditModal,
 [NodeAction.EditOptions]: openOptionsModal,
 [NodeAction.AccessoryThumbnail]: openAccessoryThumbnail,
 [NodeAction.Add]: openAdd,
 [NodeAction.Style]: openStyle,
 [NodeAction.Bind]: openBind,
};

const mediaAdds: Partial<Record<NodeAction, MediaAddKind>> = {
 [NodeAction.AddGallery]: MediaAddKind.Gallery,
 [NodeAction.AddSectionThumbnail]: MediaAddKind.SectionThumbnail,
};

const isNodeAction = (value: string): value is NodeAction =>
 (Object.values(NodeAction) as string[]).includes(value);

export const actionPick = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const [action, argPath] = args;
 if (!isNodeAction(action)) return;

 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const selectedPath = argPath && getNode(ctx.view.tree, argPath) ? argPath : null;
 if (!offersAction(ctx.view.tree, selectedPath, action)) {
  await failNote.call(this, cmd, BuilderErrorCode.NotAllowedHere);
  return;
 }
 const view: BuilderView = { ...ctx.view, selectedPath };

 const open = openers[action];
 if (open) {
  await open.call(this, cmd, view);
  return;
 }

 const change = changeFor(action);
 if (!change || !selectedPath) return;

 const t = await this.t(cmd.guild_id ?? undefined);
 const { result, selectedPath: next } = change(t, view.tree, selectedPath);
 if (!result.ok) {
  await failNote.call(this, cmd, result.error);
  return;
 }

 await presentBuilder.call(this, cmd, view.tree, {
  ...view,
  tree: result.tree,
  selectedPath: next === undefined ? selectedPath : next,
 });
};

export const addAt = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 await presentAdd.call(this, cmd, ctx.view, parseAddTarget(args));
};

export const addPick = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 const [action] = cmd.data.values;
 if (!isNodeAction(action)) return;

 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const target = parseAddTarget(args);
 const media = mediaAdds[action];
 if (media) {
  await openMediaModal.call(this, cmd, media, target);
  return;
 }

 const t = await this.t(cmd.guild_id ?? undefined);
 const node = addedNode.call(this, t, ctx.view.tree, action);
 if (!node) return;

 const added = insertAtTarget(ctx.view.tree, target, action, node);
 if (!added.ok) {
  await failNote.call(this, cmd, added.error);
  return;
 }

 await presentBuilder.call(this, cmd, ctx.view.tree, {
  ...ctx.view,
  tree: added.tree,
  selectedPath: added.path,
 });
};

export const emptyBuilder = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 await presentBuilder.call(this, cmd, ctx.view.tree, { ...ctx.view, tree: [], selectedPath: null });
};

export const backToBuilder = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const [argPath] = args;
 await presentBuilder.call(this, cmd, ctx.view.tree, {
  ...ctx.view,
  selectedPath: argPath && getNode(ctx.view.tree, argPath) ? argPath : ctx.view.selectedPath,
  marker: { execId: ctx.view.marker.execId, designId: ctx.view.marker.designId },
 });
};

export const closeThread = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (!cmd.guild_id || !cmd.channel) return;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const api = await this.getAPI(cmd.guild_id);
 await api.interactions.deferMessageUpdate(cmd.id, cmd.token, undefined, {
  origin: this.name,
  reason: 'Acknowledging builder close',
 });
 await api.channels.delete(cmd.channel.id, {
  origin: this.name,
  reason: 'Closing component builder thread',
 });
};

export const ackCustomComponent = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const api = await this.getAPI(cmd.guild_id ?? '');
 await api.interactions.deferMessageUpdate(cmd.id, cmd.token, undefined, {
  origin: this.name,
  reason: 'Acknowledging preview component',
 });
};
