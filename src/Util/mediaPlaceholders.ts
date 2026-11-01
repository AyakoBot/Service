import { MessagePlaceholder } from './messagePlaceholders.js';
import parseHttpUrl from './parseHttpUrl.js';

export const mediaPlaceholders = [
 MessagePlaceholder.Gif,
 MessagePlaceholder.UserAvatar,
 MessagePlaceholder.ServerIcon,
];

const previewImage = 'https://cdn.discordapp.com/embed/avatars/0.png';
const markerParam = 'placeholder';
const mediaParents = new Set(['media', 'image', 'thumbnail']);
const urlKey = 'url';
const iconKey = 'icon_url';
const tokenPattern = /^{{\s?(\w+)\s?}}$/;

const asMediaPlaceholder = (name: string | null | undefined): MessagePlaceholder | null =>
 mediaPlaceholders.find((placeholder) => placeholder === name) ?? null;

const tokenOf = (value: string) => asMediaPlaceholder(value.trim().match(tokenPattern)?.[1]);

const markerOf = (url: string): MessagePlaceholder | null => {
 try {
  const parsed = new URL(url);
  if (`${parsed.origin}${parsed.pathname}` !== previewImage) return null;
  return asMediaPlaceholder(parsed.searchParams.get(markerParam));
 } catch {
  return null;
 }
};

export const toMediaMarker = (placeholder: MessagePlaceholder): string => {
 const url = new URL(previewImage);
 url.searchParams.set(markerParam, placeholder);
 return url.toString();
};

export const parseMediaUrl = (value: string): string | null => {
 const placeholder = tokenOf(value);
 return placeholder ? toMediaMarker(placeholder) : parseHttpUrl(value);
};

export const displayMediaUrl = (url: string): string => {
 const placeholder = markerOf(url);
 return placeholder ? `{{${placeholder}}}` : url;
};

const isMediaSlot = (key: string, parent: string | null) =>
 key === iconKey || (key === urlKey && parent !== null && mediaParents.has(parent));

const mapMediaUrls = <T>(value: T, map: (url: string) => string, parent: string | null): T => {
 if (Array.isArray(value)) return value.map((entry) => mapMediaUrls(entry, map, parent)) as T;
 if (!value || typeof value !== 'object') return value;

 return Object.fromEntries(
  Object.entries(value).map(([key, entry]) => [
   key,
   typeof entry === 'string' && isMediaSlot(key, parent)
    ? map(entry)
    : mapMediaUrls(entry, map, key),
  ]),
 ) as T;
};

export const encodeMediaPlaceholders = <T>(value: T): T =>
 mapMediaUrls(
  value,
  (url) => {
   const placeholder = tokenOf(url);
   return placeholder ? toMediaMarker(placeholder) : url;
  },
  null,
 );

export const decodeMediaPlaceholders = <T>(value: T): T =>
 mapMediaUrls(value, displayMediaUrl, null);
