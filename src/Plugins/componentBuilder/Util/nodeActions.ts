import {
 ButtonStyle,
 ComponentType,
 SeparatorSpacingSize,
 type APIButtonComponentWithCustomId,
} from 'discord-api-types/v10';

import { NodeAction, NodeKind, wipComponentLimit } from '../Classes/Nodes.js';

import {
 countComponents,
 getNode,
 isAccessoryPath,
 kindOf,
 parentPathOf,
 type WipNode,
 type WipTree,
} from './componentTree.js';

const primaryActions: Record<NodeKind, NodeAction[]> = {
 [NodeKind.Text]: [NodeAction.Edit],
 [NodeKind.Container]: [NodeAction.Edit, NodeAction.ToggleSpoiler],
 [NodeKind.Section]: [NodeAction.AccessoryButton, NodeAction.AccessoryThumbnail],
 [NodeKind.Separator]: [NodeAction.ToggleDivider, NodeAction.ToggleSpacing],
 [NodeKind.Gallery]: [NodeAction.Edit],
 [NodeKind.Row]: [],
 [NodeKind.Button]: [
  NodeAction.Edit,
  NodeAction.Style,
  NodeAction.ToggleDisabled,
  NodeAction.Bind,
 ],
 [NodeKind.StringSelect]: [NodeAction.Edit, NodeAction.EditOptions, NodeAction.ToggleDisabled],
 [NodeKind.UserSelect]: [NodeAction.Edit, NodeAction.ToggleDisabled],
 [NodeKind.RoleSelect]: [NodeAction.Edit, NodeAction.ToggleDisabled],
 [NodeKind.ChannelSelect]: [NodeAction.Edit, NodeAction.ToggleDisabled],
 [NodeKind.MentionableSelect]: [NodeAction.Edit, NodeAction.ToggleDisabled],
 [NodeKind.Thumbnail]: [NodeAction.Edit, NodeAction.ToggleSpoiler],
};

const structureActions = [NodeAction.MoveUp, NodeAction.MoveDown, NodeAction.Remove];

export const styleOptions: { action: NodeAction; style: ButtonStyle }[] = [
 { action: NodeAction.StylePrimary, style: ButtonStyle.Primary },
 { action: NodeAction.StyleSecondary, style: ButtonStyle.Secondary },
 { action: NodeAction.StyleSuccess, style: ButtonStyle.Success },
 { action: NodeAction.StyleDanger, style: ButtonStyle.Danger },
 { action: NodeAction.StyleLink, style: ButtonStyle.Link },
];

const toggleReaders: Partial<Record<NodeAction, (raw: Record<string, unknown>) => boolean>> = {
 [NodeAction.ToggleDivider]: (raw) => raw.divider !== false,
 [NodeAction.ToggleSpacing]: (raw) => raw.spacing === SeparatorSpacingSize.Large,
 [NodeAction.ToggleSpoiler]: (raw) => Boolean(raw.spoiler),
 [NodeAction.ToggleDisabled]: (raw) => Boolean(raw.disabled),
};

export const isBindable = (node: WipNode): node is APIButtonComponentWithCustomId =>
 node.type === ComponentType.Button && 'custom_id' in node;

export const actionRowsFor = (tree: WipTree, path: string | null): NodeAction[][] => {
 const node = path ? getNode(tree, path) : null;
 const kind = node ? kindOf(node) : null;
 if (!path || !node || !kind) return [[NodeAction.Add]];

 const offered = primaryActions[kind].filter(
  (action) => action !== NodeAction.Bind || isBindable(node),
 );
 const primary = [...offered, NodeAction.Add];
 return isAccessoryPath(path) ? [primary] : [primary, structureActions];
};

export const toggleState = (node: WipNode, action: NodeAction): boolean | null => {
 const read = toggleReaders[action];
 return read ? read(node as unknown as Record<string, unknown>) : null;
};

export const moveUnit = (tree: WipTree, path: string): string => {
 const parentPath = parentPathOf(path);
 const parent = parentPath ? getNode(tree, parentPath) : null;
 return parent?.type === ComponentType.ActionRow && parent.components.length === 1
  ? parentPath
  : path;
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

export const movedSelection = (tree: WipTree, path: string, offset: -1 | 1): string => {
 const unit = moveUnit(tree, path);
 const moved = movedPath(tree, unit, offset);
 return unit === path ? moved : `${moved}.0`;
};

export const isActionDisabled = (
 tree: WipTree,
 path: string | null,
 action: NodeAction,
): boolean => {
 switch (action) {
  case NodeAction.MoveUp:
   return !path || movedSelection(tree, path, -1) === path;
  case NodeAction.MoveDown:
   return !path || movedSelection(tree, path, 1) === path;
  case NodeAction.Add:
   return countComponents(tree) >= wipComponentLimit;
  default:
   return false;
 }
};

export const offersAction = (tree: WipTree, path: string | null, action: NodeAction): boolean => {
 if (action === NodeAction.Add) return true;

 const node = path ? getNode(tree, path) : null;
 if (!path || !node) return false;

 if (styleOptions.some((option) => option.action === action)) {
  return node.type === ComponentType.Button && !('sku_id' in node);
 }
 return actionRowsFor(tree, path).flat().includes(action);
};
