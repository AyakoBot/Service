/* eslint-disable @typescript-eslint/naming-convention */
import {
 ButtonStyle,
 ComponentType,
 SeparatorSpacingSize,
 type APIButtonComponentWithCustomId,
 type APIComponentInContainer,
 type APIComponentInMessageActionRow,
 type APIContainerComponent,
 type APIMediaGalleryComponent,
 type APIMessageTopLevelComponent,
 type APISectionComponent,
 type APISelectMenuComponent,
 type APISelectMenuOption,
 type APISeparatorComponent,
 type APIStringSelectComponent,
 type APITextDisplayComponent,
 type APIThumbnailComponent,
} from 'discord-api-types/v10';

import {
 accessorySegment,
 childrenOf,
 countComponents,
 countText,
 flattenTree,
 type WipNode,
 type WipTree,
} from '../../../Util/componentBudget.js';
import {
 customIdLimit,
 galleryItemLimit,
 NodeKind,
 rowButtonLimit,
 sectionTextLimit,
 selectOptionLimit,
 wipComponentLimit,
} from '../Classes/Nodes.js';

export { countComponents, countText, flattenTree, accessorySegment };
export type { WipNode, WipTree };

export enum BuilderErrorCode {
 TooManyComponents = 'tooManyComponents',
 RowFull = 'rowFull',
 SectionFull = 'sectionFull',
 SectionNeedsText = 'sectionNeedsText',
 GalleryItemCount = 'galleryItemCount',
 SelectOptionCount = 'selectOptionCount',
 CustomIdPrefix = 'customIdPrefix',
 CustomIdTaken = 'customIdTaken',
 InvalidUrl = 'invalidUrl',
 InvalidColor = 'invalidColor',
 InvalidNumber = 'invalidNumber',
 MinOverMax = 'minOverMax',
 EmptyContent = 'emptyContent',
 TooLong = 'tooLong',
 TooMuchText = 'tooMuchText',
 UnsupportedComponent = 'unsupportedComponent',
 NotAllowedHere = 'notAllowedHere',
}

export type TreeResult =
 | { ok: true; tree: WipTree }
 | { ok: false; error: BuilderErrorCode };

export const customIdPrefix = 'c-';
export const textContentLimit = 4000;
export const wipTextBudget = 3500;
export const buttonLabelLimit = 80;
export const buttonUrlLimit = 512;
export const mediaAltLimit = 1024;
export const selectTextLimit = 100;
export const placeholderLimit = 150;

const segments = (path: string): string[] => (path ? path.split('.') : []);

export const isAccessoryPath = (path: string): boolean =>
 segments(path).at(-1) === accessorySegment;

export const parentPathOf = (path: string): string => segments(path).slice(0, -1).join('.');

export const kindOf = (node: WipNode): NodeKind | null => {
 switch (node.type) {
  case ComponentType.ActionRow:
   return NodeKind.Row;
  case ComponentType.Button:
   return NodeKind.Button;
  case ComponentType.StringSelect:
   return NodeKind.StringSelect;
  case ComponentType.UserSelect:
   return NodeKind.UserSelect;
  case ComponentType.RoleSelect:
   return NodeKind.RoleSelect;
  case ComponentType.ChannelSelect:
   return NodeKind.ChannelSelect;
  case ComponentType.MentionableSelect:
   return NodeKind.MentionableSelect;
  case ComponentType.Section:
   return NodeKind.Section;
  case ComponentType.TextDisplay:
   return NodeKind.Text;
  case ComponentType.Thumbnail:
   return NodeKind.Thumbnail;
  case ComponentType.MediaGallery:
   return NodeKind.Gallery;
  case ComponentType.Separator:
   return NodeKind.Separator;
  case ComponentType.Container:
   return NodeKind.Container;
  default:
   return null;
 }
};

export const getNode = (tree: WipTree, path: string): WipNode | null => {
 let current: WipNode | null = null;
 let pool: WipNode[] = tree;

 for (const segment of segments(path)) {
  if (segment === accessorySegment) {
   if (current?.type !== ComponentType.Section) return null;
   current = current.accessory;
   pool = [];
   continue;
  }

  if (!/^\d+$/.test(segment)) return null;
  const next = pool[Number(segment)];
  if (!next) return null;
  current = next;
  pool = childrenOf(current) ?? [];
 }

 return current;
};

const locateChild = (
 tree: WipTree,
 path: string,
): { siblings: WipNode[]; index: number } | null => {
 const parts = segments(path);
 const last = parts.at(-1);
 if (last === undefined || last === accessorySegment || !/^\d+$/.test(last)) return null;

 const parentPath = parts.slice(0, -1).join('.');
 const parent = parentPath ? getNode(tree, parentPath) : null;
 const siblings = parentPath ? (parent ? childrenOf(parent) : null) : tree;
 if (!siblings) return null;

 const index = Number(last);
 return siblings[index] ? { siblings, index } : null;
};

export const isInteractive = (
 node: WipNode,
): node is APIButtonComponentWithCustomId | APISelectMenuComponent => {
 switch (node.type) {
  case ComponentType.Button:
   return 'custom_id' in node;
  case ComponentType.StringSelect:
  case ComponentType.UserSelect:
  case ComponentType.RoleSelect:
  case ComponentType.ChannelSelect:
  case ComponentType.MentionableSelect:
   return true;
  default:
   return false;
 }
};

export const collectCustomIds = (tree: WipTree, exceptPath?: string): string[] =>
 flattenTree(tree)
  .filter((entry) => entry.path !== exceptPath && isInteractive(entry.node))
  .map((entry) => (entry.node as { custom_id: string }).custom_id);

export const nextCustomId = (tree: WipTree, base: string): string => {
 const taken = new Set(collectCustomIds(tree));
 let n = 1;
 while (taken.has(`${customIdPrefix}${base}-${n}`)) n += 1;
 return `${customIdPrefix}${base}-${n}`;
};

export const stripIds = (tree: WipTree): WipTree => {
 const clone = structuredClone(tree);

 const walk = (node: WipNode) => {
  delete node.id;
  childrenOf(node)?.forEach(walk);
  if (node.type === ComponentType.Section) walk(node.accessory);
 };

 clone.forEach(walk);
 return clone;
};

export const makeText = (content: string): APITextDisplayComponent => ({
 type: ComponentType.TextDisplay,
 content,
});

export const makeSeparator = (): APISeparatorComponent => ({
 type: ComponentType.Separator,
 divider: true,
 spacing: SeparatorSpacingSize.Small,
});

export const makeButton = (customId: string, label: string): APIButtonComponentWithCustomId => ({
 type: ComponentType.Button,
 style: ButtonStyle.Secondary,
 custom_id: customId,
 label,
});

export const makeStringSelect = (
 customId: string,
 optionLabel: string,
): APIStringSelectComponent => ({
 type: ComponentType.StringSelect,
 custom_id: customId,
 options: [{ label: optionLabel, value: 'option-1' }],
});

const entitySelectTypes = {
 [NodeKind.UserSelect]: ComponentType.UserSelect,
 [NodeKind.RoleSelect]: ComponentType.RoleSelect,
 [NodeKind.ChannelSelect]: ComponentType.ChannelSelect,
 [NodeKind.MentionableSelect]: ComponentType.MentionableSelect,
} as const;

export type EntitySelectKind = keyof typeof entitySelectTypes;

export const makeEntitySelect = (
 kind: EntitySelectKind,
 customId: string,
): APISelectMenuComponent =>
 ({ type: entitySelectTypes[kind], custom_id: customId }) as APISelectMenuComponent;

export const makeRow = (
 child: APIComponentInMessageActionRow,
): APIMessageTopLevelComponent => ({
 type: ComponentType.ActionRow,
 components: [child],
});

export const makeGallery = (
 items: { url: string; description?: string }[],
): APIMediaGalleryComponent => ({
 type: ComponentType.MediaGallery,
 items: items.map((item) => ({
  media: { url: item.url },
  description: item.description || undefined,
 })),
});

export const makeThumbnail = (url: string, description?: string): APIThumbnailComponent => ({
 type: ComponentType.Thumbnail,
 media: { url },
 description: description || undefined,
});

export const makeSectionWithButton = (
 content: string,
 customId: string,
 label: string,
): APISectionComponent => ({
 type: ComponentType.Section,
 components: [makeText(content)],
 accessory: makeButton(customId, label),
});

export const makeSectionWithThumbnail = (
 content: string,
 url: string,
): APISectionComponent => ({
 type: ComponentType.Section,
 components: [makeText(content)],
 accessory: makeThumbnail(url),
});

export const makeContainer = (content: string): APIContainerComponent => ({
 type: ComponentType.Container,
 components: [makeText(content)],
});

const topLevelKinds = [
 NodeKind.Row,
 NodeKind.Section,
 NodeKind.Text,
 NodeKind.Gallery,
 NodeKind.Separator,
 NodeKind.Container,
];

const containerChildKinds = [
 NodeKind.Row,
 NodeKind.Section,
 NodeKind.Text,
 NodeKind.Gallery,
 NodeKind.Separator,
];

export const insertNode = (
 source: WipTree,
 parentPath: string,
 node: WipNode,
): TreeResult => {
 const tree = structuredClone(source);
 const kind = kindOf(node);
 if (!kind) return { ok: false, error: BuilderErrorCode.UnsupportedComponent };

 if (countComponents(tree) + countComponents([node as APIMessageTopLevelComponent]) >
  wipComponentLimit) {
  return { ok: false, error: BuilderErrorCode.TooManyComponents };
 }

 if (countText(tree) + countText([node as APIMessageTopLevelComponent]) > wipTextBudget) {
  return { ok: false, error: BuilderErrorCode.TooMuchText };
 }

 if (!parentPath) {
  if (!topLevelKinds.includes(kind)) return { ok: false, error: BuilderErrorCode.NotAllowedHere };
  tree.push(node as APIMessageTopLevelComponent);
  return { ok: true, tree };
 }

 const parent = getNode(tree, parentPath);
 if (!parent) return { ok: false, error: BuilderErrorCode.NotAllowedHere };

 switch (parent.type) {
  case ComponentType.Container: {
   if (!containerChildKinds.includes(kind)) {
    return { ok: false, error: BuilderErrorCode.NotAllowedHere };
   }
   parent.components.push(node as APIComponentInContainer);
   return { ok: true, tree };
  }
  case ComponentType.ActionRow: {
   if (kind !== NodeKind.Button) return { ok: false, error: BuilderErrorCode.NotAllowedHere };
   const kinds = parent.components.map(kindOf);
   if (kinds.some((k) => k !== NodeKind.Button)) {
    return { ok: false, error: BuilderErrorCode.RowFull };
   }
   if (parent.components.length >= rowButtonLimit) {
    return { ok: false, error: BuilderErrorCode.RowFull };
   }
   parent.components.push(node as APIComponentInMessageActionRow);
   return { ok: true, tree };
  }
  case ComponentType.Section: {
   if (kind !== NodeKind.Text) return { ok: false, error: BuilderErrorCode.NotAllowedHere };
   if (parent.components.length >= sectionTextLimit) {
    return { ok: false, error: BuilderErrorCode.SectionFull };
   }
   parent.components.push(node as APITextDisplayComponent);
   return { ok: true, tree };
  }
  default:
   return { ok: false, error: BuilderErrorCode.NotAllowedHere };
 }
};

export const removeNode = (source: WipTree, path: string): TreeResult => {
 const tree = structuredClone(source);
 if (isAccessoryPath(path)) return { ok: false, error: BuilderErrorCode.NotAllowedHere };

 const located = locateChild(tree, path);
 if (!located) return { ok: false, error: BuilderErrorCode.NotAllowedHere };

 const parentPath = parentPathOf(path);
 const parent = parentPath ? getNode(tree, parentPath) : null;

 if (parent?.type === ComponentType.Section && parent.components.length <= 1) {
  return { ok: false, error: BuilderErrorCode.SectionNeedsText };
 }

 located.siblings.splice(located.index, 1);

 if (parent && located.siblings.length === 0) {
  return removeNode(tree, parentPath);
 }

 return { ok: true, tree };
};

export const moveNode = (source: WipTree, path: string, offset: -1 | 1): TreeResult => {
 const tree = structuredClone(source);
 const located = locateChild(tree, path);
 if (!located) return { ok: false, error: BuilderErrorCode.NotAllowedHere };

 const target = located.index + offset;
 if (target < 0 || target >= located.siblings.length) return { ok: true, tree: source };

 const [node] = located.siblings.splice(located.index, 1);
 located.siblings.splice(target, 0, node);
 return { ok: true, tree };
};

export const setAccessory = (
 source: WipTree,
 sectionPath: string,
 accessory: APISectionComponent['accessory'],
): TreeResult => {
 const tree = structuredClone(source);
 const section = getNode(tree, sectionPath);
 if (section?.type !== ComponentType.Section) {
  return { ok: false, error: BuilderErrorCode.NotAllowedHere };
 }

 section.accessory = accessory;
 return { ok: true, tree };
};

export const updateNode = (
 source: WipTree,
 path: string,
 mutate: (node: WipNode) => BuilderErrorCode | null,
): TreeResult => {
 const tree = structuredClone(source);
 const node = getNode(tree, path);
 if (!node) return { ok: false, error: BuilderErrorCode.NotAllowedHere };

 const error = mutate(node);
 if (error) return { ok: false, error };
 if (countText(tree) > wipTextBudget) return { ok: false, error: BuilderErrorCode.TooMuchText };
 return { ok: true, tree };
};

export const parseHttpUrl = (value: string): string | null => {
 try {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
 } catch {
  return null;
 }
};

const checkCustomId = (id: unknown, seen: Set<string>): BuilderErrorCode | null => {
 if (typeof id !== 'string' || !id.startsWith(customIdPrefix) || id.length > customIdLimit) {
  return BuilderErrorCode.CustomIdPrefix;
 }
 if (seen.has(id)) return BuilderErrorCode.CustomIdTaken;
 seen.add(id);
 return null;
};

const kindOfSafe = (node: unknown): NodeKind | null =>
 (node && typeof node === 'object' && typeof (node as { type?: unknown }).type === 'number'
  ? kindOf(node as WipNode)
  : null);

const selectKinds = [
 NodeKind.StringSelect,
 NodeKind.UserSelect,
 NodeKind.RoleSelect,
 NodeKind.ChannelSelect,
 NodeKind.MentionableSelect,
];

const validateOption = (option: APISelectMenuOption): BuilderErrorCode | null => {
 if (!option || typeof option !== 'object') return BuilderErrorCode.UnsupportedComponent;
 if (typeof option.label !== 'string' || !option.label ||
  typeof option.value !== 'string' || !option.value) {
  return BuilderErrorCode.EmptyContent;
 }
 if (option.label.length > selectTextLimit || option.value.length > selectTextLimit ||
  (option.description?.length ?? 0) > selectTextLimit) {
  return BuilderErrorCode.TooLong;
 }
 return null;
};

const validateSelect = (
 node: APISelectMenuComponent,
 seen: Set<string>,
): BuilderErrorCode | null => {
 const idError = checkCustomId(node.custom_id, seen);
 if (idError) return idError;

 if ((node.placeholder?.length ?? 0) > placeholderLimit) return BuilderErrorCode.TooLong;

 const max = node.max_values ?? 1;
 const min = node.min_values ?? 1;
 if (!Number.isInteger(min) || !Number.isInteger(max) ||
  min < 0 || max < 1 || max > selectOptionLimit) {
  return BuilderErrorCode.InvalidNumber;
 }
 if (min > max) return BuilderErrorCode.MinOverMax;

 if (node.type !== ComponentType.StringSelect) return null;
 if (!Array.isArray(node.options) || !node.options.length ||
  node.options.length > selectOptionLimit) {
  return BuilderErrorCode.SelectOptionCount;
 }
 for (const option of node.options) {
  const optionError = validateOption(option);
  if (optionError) return optionError;
 }
 if (max > node.options.length) return BuilderErrorCode.MinOverMax;
 return null;
};

const validateButtonLabel = (label: unknown, emoji: unknown): BuilderErrorCode | null => {
 if (typeof label === 'string' && label) {
  return label.length > buttonLabelLimit ? BuilderErrorCode.TooLong : null;
 }
 return emoji ? null : BuilderErrorCode.EmptyContent;
};

const validateButton = (
 node: Extract<WipNode, { type: ComponentType.Button }>,
 seen: Set<string>,
): BuilderErrorCode | null => {
 const raw = node as unknown as Record<string, unknown>;

 switch (node.style) {
  case ButtonStyle.Primary:
  case ButtonStyle.Secondary:
  case ButtonStyle.Success:
  case ButtonStyle.Danger: {
   if (raw.url !== undefined || raw.sku_id !== undefined) {
    return BuilderErrorCode.NotAllowedHere;
   }
   const labelError = validateButtonLabel(raw.label, raw.emoji);
   if (labelError) return labelError;
   return checkCustomId(raw.custom_id, seen);
  }
  case ButtonStyle.Link: {
   if (raw.custom_id !== undefined || raw.sku_id !== undefined) {
    return BuilderErrorCode.NotAllowedHere;
   }
   const labelError = validateButtonLabel(raw.label, raw.emoji);
   if (labelError) return labelError;
   if (typeof raw.url !== 'string' || raw.url.length > buttonUrlLimit ||
    !parseHttpUrl(raw.url)) {
    return BuilderErrorCode.InvalidUrl;
   }
   return null;
  }
  default:
   return BuilderErrorCode.UnsupportedComponent;
 }
};

const validateNode = (
 node: WipNode,
 seen: Set<string>,
 topLevel: boolean,
): BuilderErrorCode | null => {
 const kind = kindOfSafe(node);
 if (!kind) return BuilderErrorCode.UnsupportedComponent;
 if (topLevel && !topLevelKinds.includes(kind)) return BuilderErrorCode.NotAllowedHere;

 switch (node.type) {
  case ComponentType.TextDisplay:
   if (typeof node.content !== 'string' || !node.content) return BuilderErrorCode.EmptyContent;
   if (node.content.length > textContentLimit) return BuilderErrorCode.TooLong;
   return null;
  case ComponentType.Separator:
   return null;
  case ComponentType.Thumbnail:
   if ((node.description?.length ?? 0) > mediaAltLimit) return BuilderErrorCode.TooLong;
   return typeof node.media?.url === 'string' && parseHttpUrl(node.media.url)
    ? null
    : BuilderErrorCode.InvalidUrl;
  case ComponentType.MediaGallery: {
   if (!Array.isArray(node.items) || !node.items.length ||
    node.items.length > galleryItemLimit) {
    return BuilderErrorCode.GalleryItemCount;
   }
   if (node.items.some((item) => (item?.description?.length ?? 0) > mediaAltLimit)) {
    return BuilderErrorCode.TooLong;
   }
   return node.items.every(
    (item) => typeof item?.media?.url === 'string' && parseHttpUrl(item.media.url),
   )
    ? null
    : BuilderErrorCode.InvalidUrl;
  }
  case ComponentType.Button:
   return validateButton(node, seen);
  case ComponentType.StringSelect:
  case ComponentType.UserSelect:
  case ComponentType.RoleSelect:
  case ComponentType.ChannelSelect:
  case ComponentType.MentionableSelect:
   return validateSelect(node, seen);
  case ComponentType.ActionRow: {
   if (!Array.isArray(node.components) || !node.components.length) {
    return BuilderErrorCode.RowFull;
   }
   const kinds = node.components.map((child) => kindOfSafe(child));
   if (kinds.every((k) => k === NodeKind.Button)) {
    if (node.components.length > rowButtonLimit) return BuilderErrorCode.RowFull;
   } else if (node.components.length !== 1 || !selectKinds.includes(kinds[0] as NodeKind)) {
    return BuilderErrorCode.RowFull;
   }
   for (const child of node.components) {
    const error = validateNode(child, seen, false);
    if (error) return error;
   }
   return null;
  }
  case ComponentType.Section: {
   if (!Array.isArray(node.components) || !node.components.length ||
    node.components.length > sectionTextLimit) {
    return BuilderErrorCode.SectionFull;
   }
   for (const child of node.components) {
    if (kindOfSafe(child) !== NodeKind.Text) return BuilderErrorCode.NotAllowedHere;
    const error = validateNode(child, seen, false);
    if (error) return error;
   }
   const accessoryKind = kindOfSafe(node.accessory);
   if (accessoryKind !== NodeKind.Button && accessoryKind !== NodeKind.Thumbnail) {
    return BuilderErrorCode.NotAllowedHere;
   }
   return validateNode(node.accessory, seen, false);
  }
  case ComponentType.Container: {
   if (typeof node.accent_color === 'number' &&
    (node.accent_color < 0 || node.accent_color > 0xffffff)) {
    return BuilderErrorCode.InvalidColor;
   }
   if (!Array.isArray(node.components) || !node.components.length) {
    return BuilderErrorCode.EmptyContent;
   }
   for (const child of node.components) {
    const childKind = kindOfSafe(child);
    if (!childKind || !containerChildKinds.includes(childKind)) {
     return BuilderErrorCode.NotAllowedHere;
    }
    const error = validateNode(child, seen, false);
    if (error) return error;
   }
   return null;
  }
  default:
   return BuilderErrorCode.UnsupportedComponent;
 }
};

export const validateTree = (tree: WipTree): BuilderErrorCode | null => {
 if (countComponents(tree) > wipComponentLimit) return BuilderErrorCode.TooManyComponents;
 if (countText(tree) > wipTextBudget) return BuilderErrorCode.TooMuchText;

 const seen = new Set<string>();
 for (const node of tree) {
  const error = validateNode(node, seen, true);
  if (error) return error;
 }
 return null;
};

export const normalizeImport = (parsed: unknown): WipTree | null => {
 if (Array.isArray(parsed)) return parsed as WipTree;
 if (!parsed || typeof parsed !== 'object') return null;

 const record = parsed as Record<string, unknown>;
 if (Array.isArray(record.components)) return record.components as WipTree;
 if (typeof record.type === 'number') return [record as unknown as APIMessageTopLevelComponent];
 return null;
};
