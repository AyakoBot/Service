import {
 ButtonStyle,
 ComponentType,
 SeparatorSpacingSize,
 type APIMessageComponentInteraction,
} from 'discord-api-types/v10';

import { MediaAddKind, NodeAction, NodeKind } from '../../Classes/Nodes.js';
import type ComponentBuilderPlugin from '../../Plugin.js';
import { applyErrorText } from '../../Util/applyErrorText.js';
import { builderContext, ephemeralNote, type BuilderView } from '../../Util/builderContext.js';
import {
 BuilderErrorCode,
 getNode,
 insertNode,
 kindOf,
 makeButton,
 makeContainer,
 makeEntitySelect,
 makeRow,
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
} from '../../Util/componentTree.js';
import { renderBuilder } from '../../Util/renderBuilder.js';

import { openEditModal, openMediaModal, openOptionsModal } from './editorModal.js';

type Translator = Awaited<ReturnType<ComponentBuilderPlugin['t']>>;

const rerender = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 view: BuilderView,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 renderBuilder.call(this, t, view).update(cmd);
};

const failNote = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
 error: BuilderErrorCode,
) {
 const t = await this.t(cmd.guild_id ?? undefined);
 ephemeralNote.call(this, cmd, applyErrorText(t, error));
};

export const nodePick = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const [value] = cmd.data.values;
 const selectedPath = value && getNode(ctx.view.tree, value) ? value : null;
 await rerender.call(this, cmd, { ...ctx.view, selectedPath });
};

const toggleNode = (
 tree: WipTree,
 path: string,
 action: NodeAction,
): TreeResult =>
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

const buttonStyles: Partial<Record<NodeAction, ButtonStyle>> = {
 [NodeAction.StylePrimary]: ButtonStyle.Primary,
 [NodeAction.StyleSecondary]: ButtonStyle.Secondary,
 [NodeAction.StyleSuccess]: ButtonStyle.Success,
 [NodeAction.StyleDanger]: ButtonStyle.Danger,
 [NodeAction.StyleLink]: ButtonStyle.Link,
};

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
  case NodeAction.AddTextChild:
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

const interactiveAdds = [
 NodeAction.AddButton,
 NodeAction.AddStringSelect,
 NodeAction.AddUserSelect,
 NodeAction.AddRoleSelect,
 NodeAction.AddChannelSelect,
 NodeAction.AddMentionableSelect,
];

const addNode = function (
 this: ComponentBuilderPlugin,
 t: Translator,
 view: BuilderView,
 action: NodeAction,
): TreeResult {
 const node = addedNode.call(this, t, view.tree, action);
 if (!node) return { ok: false, error: BuilderErrorCode.NotAllowedHere };

 const selected = view.selectedPath ? getNode(view.tree, view.selectedPath) : null;
 const selectedKind = selected ? kindOf(selected) : null;

 const intoRow = selectedKind === NodeKind.Row && action === NodeAction.AddButton;
 const needsRow =
  !intoRow && interactiveAdds.includes(action) && kindOf(node) !== NodeKind.Row;

 const parentPath =
  selectedKind === NodeKind.Container || selectedKind === NodeKind.Section || intoRow
   ? (view.selectedPath ?? '')
   : '';

 return insertNode(view.tree, parentPath, needsRow ? makeRow(node as never) : node);
};

const movedPath = (tree: WipTree, path: string, offset: -1 | 1): string => {
 const parts = path.split('.');
 const last = parts.at(-1);
 if (last === undefined || !/^\d+$/.test(last)) return path;

 const target = Number(last) + offset;
 if (target < 0) return path;

 const targetPath = [...parts.slice(0, -1), String(target)].join('.');
 return getNode(tree, targetPath) ? targetPath : path;
};

const newNodePath = (view: BuilderView, result: WipTree, action: NodeAction): string | null => {
 const selected = view.selectedPath ? getNode(view.tree, view.selectedPath) : null;
 const selectedKind = selected ? kindOf(selected) : null;

 const intoSelected =
  selectedKind === NodeKind.Container ||
  selectedKind === NodeKind.Section ||
  (selectedKind === NodeKind.Row && action === NodeAction.AddButton);

 if (!intoSelected || !view.selectedPath) return String(result.length - 1);

 const parent = getNode(result, view.selectedPath);
 if (!parent) return null;
 const children =
  parent.type === ComponentType.ActionRow ||
  parent.type === ComponentType.Container ||
  parent.type === ComponentType.Section
   ? parent.components
   : [];
 return `${view.selectedPath}.${children.length - 1}`;
};

export const actionPick = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 if (cmd.data.component_type !== ComponentType.StringSelect) return;
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 const t = await this.t(cmd.guild_id ?? undefined);
 const [value] = cmd.data.values;
 if (!(Object.values(NodeAction) as string[]).includes(value)) return;
 const action = value as NodeAction;
 const { view } = ctx;
 const path = view.selectedPath;

 switch (action) {
  case NodeAction.Edit:
   await openEditModal.call(this, cmd, view);
   return;
  case NodeAction.EditOptions:
   await openOptionsModal.call(this, cmd, view);
   return;
  case NodeAction.AddGallery:
   await openMediaModal.call(this, cmd, MediaAddKind.Gallery);
   return;
  case NodeAction.AddSectionThumbnail:
   await openMediaModal.call(this, cmd, MediaAddKind.SectionThumbnail);
   return;
  case NodeAction.AccessoryThumbnail:
   await openMediaModal.call(this, cmd, MediaAddKind.AccessoryThumbnail);
   return;
  default:
   break;
 }

 const result = ((): { result: TreeResult; selectedPath?: string | null } | null => {
  switch (action) {
   case NodeAction.MoveUp:
    return path
     ? { result: moveNode(view.tree, path, -1), selectedPath: movedPath(view.tree, path, -1) }
     : null;
   case NodeAction.MoveDown:
    return path
     ? { result: moveNode(view.tree, path, 1), selectedPath: movedPath(view.tree, path, 1) }
     : null;
   case NodeAction.Remove:
    return path ? { result: removeNode(view.tree, path), selectedPath: null } : null;
   case NodeAction.ToggleDivider:
   case NodeAction.ToggleSpacing:
   case NodeAction.ToggleSpoiler:
   case NodeAction.ToggleDisabled:
    return path ? { result: toggleNode(view.tree, path, action) } : null;
   case NodeAction.StylePrimary:
   case NodeAction.StyleSecondary:
   case NodeAction.StyleSuccess:
   case NodeAction.StyleDanger:
   case NodeAction.StyleLink:
    return path
     ? { result: setButtonStyle(view.tree, path, buttonStyles[action] as ButtonStyle) }
     : null;
   case NodeAction.AccessoryButton:
    return path
     ? {
        result: setAccessory(
         view.tree,
         path,
         makeButton(nextCustomId(view.tree, 'button'), t.defaults.buttonLabel()),
        ),
       }
     : null;
   default: {
    const added = addNode.call(this, t, view, action);
    return {
     result: added,
     selectedPath: added.ok ? newNodePath(view, added.tree, action) : undefined,
    };
   }
  }
 })();

 if (!result) return;
 if (!result.result.ok) {
  await failNote.call(this, cmd, result.result.error);
  return;
 }

 await rerender.call(this, cmd, {
  ...view,
  tree: result.result.tree,
  selectedPath:
   result.selectedPath === undefined ? view.selectedPath : result.selectedPath,
 });
};

export const emptyBuilder = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 await rerender.call(this, cmd, { ...ctx.view, tree: [], selectedPath: null });
};

export const backToBuilder = async function (
 this: ComponentBuilderPlugin,
 cmd: APIMessageComponentInteraction,
) {
 const ctx = await builderContext.call(this, cmd);
 if (!ctx) return;

 await rerender.call(this, cmd, {
  ...ctx.view,
  marker: { execId: ctx.view.marker.execId },
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
