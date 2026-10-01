import { ComponentType, type APIComponentInMessageActionRow } from 'discord-api-types/v10';

import { childrenOf } from '../../../Util/componentBudget.js';
import {
 NodeAction,
 NodeKind,
 rowButtonLimit,
 sectionTextLimit,
 wipComponentLimit,
} from '../Classes/Nodes.js';

import {
 BuilderErrorCode,
 countComponents,
 getNode,
 insertNode,
 isAccessoryPath,
 kindOf,
 makeRow,
 parentPathOf,
 type WipNode,
 type WipTree,
} from './componentTree.js';

export enum AddPosition {
 Inside = 'in',
 After = 'after',
 End = 'end',
}

export interface AddTarget {
 position: AddPosition;
 selectedPath: string | null;
}

export interface AddPlacement {
 anchor: string | null;
 parentPath: string;
 index: number;
 actions: NodeAction[];
}

export type AddResult =
 { ok: true; tree: WipTree; path: string } | { ok: false; error: BuilderErrorCode };

export const rootAddActions = [
 NodeAction.AddText,
 NodeAction.AddContainer,
 NodeAction.AddSectionButton,
 NodeAction.AddSectionThumbnail,
 NodeAction.AddSeparator,
 NodeAction.AddGallery,
 NodeAction.AddButton,
 NodeAction.AddStringSelect,
 NodeAction.AddUserSelect,
 NodeAction.AddRoleSelect,
 NodeAction.AddChannelSelect,
 NodeAction.AddMentionableSelect,
];

export const addedKinds: Partial<Record<NodeAction, NodeKind>> = {
 [NodeAction.AddText]: NodeKind.Text,
 [NodeAction.AddContainer]: NodeKind.Container,
 [NodeAction.AddSectionButton]: NodeKind.Section,
 [NodeAction.AddSectionThumbnail]: NodeKind.Thumbnail,
 [NodeAction.AddSeparator]: NodeKind.Separator,
 [NodeAction.AddGallery]: NodeKind.Gallery,
 [NodeAction.AddButton]: NodeKind.Button,
 [NodeAction.AddStringSelect]: NodeKind.StringSelect,
 [NodeAction.AddUserSelect]: NodeKind.UserSelect,
 [NodeAction.AddRoleSelect]: NodeKind.RoleSelect,
 [NodeAction.AddChannelSelect]: NodeKind.ChannelSelect,
 [NodeAction.AddMentionableSelect]: NodeKind.MentionableSelect,
};

const addCosts: Partial<Record<NodeAction, number>> = {
 [NodeAction.AddContainer]: 2,
 [NodeAction.AddSectionButton]: 3,
 [NodeAction.AddSectionThumbnail]: 3,
};

const containerAddActions = rootAddActions.filter((action) => action !== NodeAction.AddContainer);

const parentKinds = [NodeKind.Container, NodeKind.Section, NodeKind.Row];

const rowKinds = [
 NodeKind.Button,
 NodeKind.StringSelect,
 NodeKind.UserSelect,
 NodeKind.RoleSelect,
 NodeKind.ChannelSelect,
 NodeKind.MentionableSelect,
];

const wrapsInRow = (
 tree: WipTree,
 parentPath: string,
 kind: NodeKind | null | undefined,
): boolean => {
 const parent = parentPath ? getNode(tree, parentPath) : null;
 return parent?.type !== ComponentType.ActionRow && !!kind && rowKinds.includes(kind);
};

export const actionsInside = (tree: WipTree, parentPath: string): NodeAction[] => {
 if (!parentPath) return rootAddActions;

 const parent = getNode(tree, parentPath);
 if (!parent) return [];

 switch (parent.type) {
  case ComponentType.Container:
   return containerAddActions;
  case ComponentType.Section:
   return parent.components.length < sectionTextLimit ? [NodeAction.AddText] : [];
  case ComponentType.ActionRow:
   return parent.components.length < rowButtonLimit &&
    parent.components.every((child) => kindOf(child) === NodeKind.Button)
    ? [NodeAction.AddButton]
    : [];
  default:
   return [];
 }
};

const afterAnchor = (tree: WipTree, path: string): string => {
 if (isAccessoryPath(path)) return parentPathOf(path);

 const parentPath = parentPathOf(path);
 const parent = parentPath ? getNode(tree, parentPath) : null;
 const narrow = parent?.type === ComponentType.ActionRow || parent?.type === ComponentType.Section;
 return narrow && !actionsInside(tree, parentPath).length ? parentPath : path;
};

const existing = (tree: WipTree, path: string | null): string | null =>
 path && getNode(tree, path) ? path : null;

const childCount = (tree: WipTree, path: string): number => {
 const node = getNode(tree, path);
 return node ? (childrenOf(node)?.length ?? 0) : 0;
};

export const resolvePlacement = (tree: WipTree, target: AddTarget): AddPlacement | null => {
 const selected = existing(tree, target.selectedPath);

 switch (target.position) {
  case AddPosition.Inside: {
   const actions = selected ? actionsInside(tree, selected) : [];
   if (!selected || !actions.length) return null;
   return { anchor: selected, parentPath: selected, index: childCount(tree, selected), actions };
  }
  case AddPosition.After: {
   if (!selected) return null;
   const anchor = afterAnchor(tree, selected);
   const parentPath = parentPathOf(anchor);
   return {
    anchor,
    parentPath,
    index: Number(anchor.split('.').at(-1)) + 1,
    actions: actionsInside(tree, parentPath),
   };
  }
  case AddPosition.End:
   return { anchor: null, parentPath: '', index: tree.length, actions: rootAddActions };
  default:
   return null;
 }
};

export const addCost = (tree: WipTree, parentPath: string, action: NodeAction): number =>
 (addCosts[action] ?? 1) + (wrapsInRow(tree, parentPath, addedKinds[action]) ? 1 : 0);

export const affordableActions = (tree: WipTree, placement: AddPlacement): NodeAction[] => {
 const room = wipComponentLimit - countComponents(tree);
 return placement.actions.filter((action) => addCost(tree, placement.parentPath, action) <= room);
};

export const positionsFor = (tree: WipTree, selectedPath: string | null): AddPosition[] => {
 const node = selectedPath ? getNode(tree, selectedPath) : null;
 if (!node) return [AddPosition.End];

 const kind = kindOf(node);
 const inside = kind && parentKinds.includes(kind) ? [AddPosition.Inside] : [];
 return [...inside, AddPosition.After, AddPosition.End];
};

export const defaultPosition = (tree: WipTree, selectedPath: string | null): AddPosition => {
 const selected = existing(tree, selectedPath);
 if (!selected) return AddPosition.End;

 return resolvePlacement(tree, { position: AddPosition.Inside, selectedPath: selected })
  ? AddPosition.Inside
  : AddPosition.After;
};

export const normalizeTarget = (tree: WipTree, target: AddTarget): AddTarget => {
 const selectedPath = existing(tree, target.selectedPath);
 const next = { position: target.position, selectedPath };
 if (resolvePlacement(tree, next)) return next;
 return { position: defaultPosition(tree, selectedPath), selectedPath };
};

export const addTargetArgs = (target: AddTarget): string[] => [
 target.position,
 target.selectedPath ?? '',
];

export const parseAddTarget = ([position, selectedPath]: string[]): AddTarget => ({
 position: (Object.values(AddPosition) as string[]).includes(position)
  ? (position as AddPosition)
  : AddPosition.End,
 selectedPath: selectedPath || null,
});

export const insertAtTarget = (
 tree: WipTree,
 target: AddTarget,
 action: NodeAction,
 node: WipNode,
): AddResult => {
 const placement = resolvePlacement(tree, target);
 if (!placement || !placement.actions.includes(action)) {
  return { ok: false, error: BuilderErrorCode.NotAllowedHere };
 }

 const wrap = wrapsInRow(tree, placement.parentPath, kindOf(node));

 const result = insertNode(
  tree,
  placement.parentPath,
  wrap ? makeRow(node as APIComponentInMessageActionRow) : node,
  placement.index,
 );
 if (!result.ok) return result;

 const path = [placement.parentPath, String(placement.index), ...(wrap ? ['0'] : [])]
  .filter(Boolean)
  .join('.');
 return { ok: true, tree: result.tree, path };
};
