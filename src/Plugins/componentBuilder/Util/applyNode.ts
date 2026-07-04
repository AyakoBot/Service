import {
 ComponentType,
 type APISelectMenuOption,
 type APIStringSelectComponent,
} from 'discord-api-types/v10';

import { parseColor } from '../../../Util/parseColor.js';
import { customIdLimit, galleryItemLimit, selectOptionLimit } from '../Classes/Nodes.js';

import {
 BuilderErrorCode,
 buttonLabelLimit,
 collectCustomIds,
 customIdPrefix,
 mediaAltLimit,
 parseHttpUrl,
 textContentLimit,
 updateNode,
 type TreeResult,
 type WipTree,
} from './componentTree.js';

export const checkEditableCustomId = (
 id: string,
 tree: WipTree,
 exceptPath: string,
): BuilderErrorCode | null => {
 if (!id.startsWith(customIdPrefix) || id.length > customIdLimit) {
  return BuilderErrorCode.CustomIdPrefix;
 }
 if (collectCustomIds(tree, exceptPath).includes(id)) return BuilderErrorCode.CustomIdTaken;
 return null;
};

export const parseGalleryLines = (
 raw: string,
): { url: string; description?: string }[] | BuilderErrorCode => {
 const lines = raw
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
 if (!lines.length || lines.length > galleryItemLimit) {
  return BuilderErrorCode.GalleryItemCount;
 }

 const items: { url: string; description?: string }[] = [];
 for (const line of lines) {
  const [rawUrl, ...rest] = line.split('|');
  const url = parseHttpUrl(rawUrl.trim());
  if (!url) return BuilderErrorCode.InvalidUrl;
  items.push({ url, description: rest.join('|').trim().slice(0, mediaAltLimit) || undefined });
 }
 return items;
};

export const parseOptionLines = (raw: string): APISelectMenuOption[] | BuilderErrorCode => {
 const lines = raw
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);
 if (!lines.length || lines.length > selectOptionLimit) {
  return BuilderErrorCode.SelectOptionCount;
 }

 const options: APISelectMenuOption[] = [];
 for (const line of lines) {
  const [rawLabel, rawValue, ...rest] = line.split('|');
  const label = rawLabel.trim().slice(0, 100);
  if (!label) return BuilderErrorCode.EmptyContent;

  const value = (rawValue?.trim() || label).slice(0, 100);
  const description = rest.join('|').trim().slice(0, 100);
  options.push({ label, value, description: description || undefined });
 }

 if (new Set(options.map((option) => option.value)).size !== options.length) {
  return BuilderErrorCode.CustomIdTaken;
 }
 return options;
};

export const applyText = (tree: WipTree, path: string, content: string): TreeResult =>
 updateNode(tree, path, (node) => {
  if (node.type !== ComponentType.TextDisplay) return BuilderErrorCode.NotAllowedHere;
  const trimmed = content.trim().slice(0, textContentLimit);
  if (!trimmed) return BuilderErrorCode.EmptyContent;
  node.content = trimmed;
  return null;
 });

export const applyContainer = (tree: WipTree, path: string, rawColor: string): TreeResult =>
 updateNode(tree, path, (node) => {
  if (node.type !== ComponentType.Container) return BuilderErrorCode.NotAllowedHere;
  if (!rawColor.trim()) {
   delete node.accent_color;
   return null;
  }
  const color = parseColor(rawColor);
  if (color === null) return BuilderErrorCode.InvalidColor;
  node.accent_color = color;
  return null;
 });

export const applyThumbnail = (
 tree: WipTree,
 path: string,
 rawUrl: string,
 description: string,
): TreeResult =>
 updateNode(tree, path, (node) => {
  if (node.type !== ComponentType.Thumbnail) return BuilderErrorCode.NotAllowedHere;
  const url = parseHttpUrl(rawUrl.trim());
  if (!url) return BuilderErrorCode.InvalidUrl;
  node.media = { url };
  node.description = description.trim().slice(0, mediaAltLimit) || undefined;
  return null;
 });

export const applyGallery = (tree: WipTree, path: string, raw: string): TreeResult => {
 const items = parseGalleryLines(raw);
 if (!Array.isArray(items)) return { ok: false, error: items };

 return updateNode(tree, path, (node) => {
  if (node.type !== ComponentType.MediaGallery) return BuilderErrorCode.NotAllowedHere;
  node.items = items.map((item) => ({
   media: { url: item.url },
   description: item.description,
  }));
  return null;
 });
};

export const applyButton = (
 tree: WipTree,
 path: string,
 label: string,
 idOrUrl: string,
): TreeResult =>
 updateNode(tree, path, (node) => {
  if (node.type !== ComponentType.Button || 'sku_id' in node) {
   return BuilderErrorCode.NotAllowedHere;
  }

  const trimmedLabel = label.trim().slice(0, buttonLabelLimit);
  if (!trimmedLabel) return BuilderErrorCode.EmptyContent;
  node.label = trimmedLabel;

  const value = idOrUrl.trim();
  if ('url' in node) {
   const url = parseHttpUrl(value);
   if (!url) return BuilderErrorCode.InvalidUrl;
   node.url = url;
   return null;
  }

  const idError = checkEditableCustomId(value, tree, path);
  if (idError) return idError;
  node.custom_id = value;
  return null;
 });

export const applySelect = (
 tree: WipTree,
 path: string,
 customId: string,
 placeholder: string,
 rawMin: string,
 rawMax: string,
): TreeResult =>
 updateNode(tree, path, (node) => {
  switch (node.type) {
   case ComponentType.StringSelect:
   case ComponentType.UserSelect:
   case ComponentType.RoleSelect:
   case ComponentType.ChannelSelect:
   case ComponentType.MentionableSelect:
    break;
   default:
    return BuilderErrorCode.NotAllowedHere;
  }

  const idError = checkEditableCustomId(customId.trim(), tree, path);
  if (idError) return idError;
  node.custom_id = customId.trim();
  node.placeholder = placeholder.trim().slice(0, 150) || undefined;

  const optionCap =
   node.type === ComponentType.StringSelect ? node.options.length : selectOptionLimit;
  const min = rawMin.trim() ? Number(rawMin.trim()) : 1;
  const max = rawMax.trim() ? Number(rawMax.trim()) : 1;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1 || max > 25) {
   return BuilderErrorCode.InvalidNumber;
  }
  if (min > max || max > optionCap) return BuilderErrorCode.MinOverMax;

  node.min_values = min;
  node.max_values = max;
  return null;
 });

export const applySelectOptions = (tree: WipTree, path: string, raw: string): TreeResult => {
 const options = parseOptionLines(raw);
 if (!Array.isArray(options)) return { ok: false, error: options };

 return updateNode(tree, path, (node) => {
  if (node.type !== ComponentType.StringSelect) return BuilderErrorCode.NotAllowedHere;
  const select = node as APIStringSelectComponent;
  select.options = options;
  if ((select.max_values ?? 1) > options.length) select.max_values = options.length;
  if ((select.min_values ?? 1) > options.length) select.min_values = options.length;
  return null;
 });
};
