import type { APIEmbed } from 'discord-api-types/v10';

import { EmbedProperty, propertyLengths } from '../Classes/Properties.js';

export enum ApplyErrorCode {
 InvalidColor = 'invalidColor',
 InvalidTimestamp = 'invalidTimestamp',
 InvalidUrl = 'invalidUrl',
 NoFieldSelected = 'noFieldSelected',
}

export type ApplyResult = { ok: true; embed: APIEmbed } | { ok: false; error: ApplyErrorCode };

export const blank = String.fromCharCode(0x200b);

const clampedValue = (property: EmbedProperty, value: string | null): string | null => {
 if (!value) return null;
 const max = propertyLengths[property];
 return max ? value.slice(0, max) : value;
};

const parseUrl = (value: string): string | null => {
 try {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
 } catch {
  return null;
 }
};

export const parseColor = (value: string): number | null => {
 const match = value.trim().replace(/^#/, '');
 if (!/^[0-9a-f]{6}$/i.test(match)) return null;
 return parseInt(match, 16);
};

export enum TimestampToken {
 Now = 'now',
 Time = '@time',
}

export const parseTimestamp = (value: string): string | null => {
 const trimmed = value.trim();
 const lower = trimmed.toLowerCase();
 if (lower === TimestampToken.Now || lower === TimestampToken.Time) return new Date().toISOString();
 if (/^\d+$/.test(trimmed)) {
  const seconds = Number(trimmed);
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
 }

 if (trimmed.startsWith('<t:')) {
  const digits = trimmed.replace(/\D+/g, '');
  if (!digits) return null;
  const date = new Date(Number(digits) * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
 }

 const date = new Date(trimmed);
 return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const setAuthorPart = (
 embed: APIEmbed,
 part: { name?: string | null; iconUrl?: string | null; url?: string | null },
): void => {
 const author = {
  name: part.name !== undefined ? part.name : (embed.author?.name ?? null),
  icon_url: part.iconUrl !== undefined ? part.iconUrl : (embed.author?.icon_url ?? null),
  url: part.url !== undefined ? part.url : (embed.author?.url ?? null),
 };

 if (!author.name && !author.icon_url && !author.url) {
  delete embed.author;
  return;
 }

 embed.author = {
  name: author.name || blank,
  icon_url: author.icon_url ?? undefined,
  url: author.url ?? undefined,
 };
};

const setFooterPart = (
 embed: APIEmbed,
 part: { text?: string | null; iconUrl?: string | null },
): void => {
 const footer = {
  text: part.text !== undefined ? part.text : (embed.footer?.text ?? null),
  icon_url: part.iconUrl !== undefined ? part.iconUrl : (embed.footer?.icon_url ?? null),
 };

 if (!footer.text && !footer.icon_url) {
  delete embed.footer;
  return;
 }

 embed.footer = { text: footer.text || blank, icon_url: footer.icon_url ?? undefined };
};

const applyUrlProperty = (
 embed: APIEmbed,
 property: EmbedProperty,
 url: string | null,
): ApplyResult => {
 switch (property) {
  case EmbedProperty.Url:
   if (url) embed.url = url;
   else delete embed.url;
   return { ok: true, embed };
  case EmbedProperty.Image:
   if (url) embed.image = { url };
   else delete embed.image;
   return { ok: true, embed };
  case EmbedProperty.Thumbnail:
   if (url) embed.thumbnail = { url };
   else delete embed.thumbnail;
   return { ok: true, embed };
  case EmbedProperty.AuthorIcon:
   setAuthorPart(embed, { iconUrl: url });
   return { ok: true, embed };
  case EmbedProperty.AuthorUrl:
   setAuthorPart(embed, { url });
   return { ok: true, embed };
  case EmbedProperty.FooterIcon:
   setFooterPart(embed, { iconUrl: url });
   return { ok: true, embed };
  default:
   return { ok: false, error: ApplyErrorCode.InvalidUrl };
 }
};

const applyFieldProperty = (
 embed: APIEmbed,
 property: EmbedProperty,
 value: string | null,
 fieldIndex: number | null,
): ApplyResult => {
 if (fieldIndex === null || !embed.fields?.[fieldIndex]) {
  return { ok: false, error: ApplyErrorCode.NoFieldSelected };
 }

 const field = embed.fields[fieldIndex];
 switch (property) {
  case EmbedProperty.FieldName:
   field.name = value || blank;
   break;
  case EmbedProperty.FieldValue:
   field.value = value || blank;
   break;
  case EmbedProperty.FieldInline:
   field.inline = !field.inline;
   break;
  default:
   return { ok: false, error: ApplyErrorCode.NoFieldSelected };
 }

 return { ok: true, embed };
};

export const applyProperty = (
 source: APIEmbed,
 property: EmbedProperty,
 rawValue: string | null,
 fieldIndex: number | null,
): ApplyResult => {
 const embed = structuredClone(source);
 const value = clampedValue(property, rawValue);

 switch (property) {
  case EmbedProperty.Title:
   if (value) embed.title = value;
   else delete embed.title;
   return { ok: true, embed };

  case EmbedProperty.Description:
   if (value) embed.description = value;
   else delete embed.description;
   return { ok: true, embed };

  case EmbedProperty.AuthorName:
   setAuthorPart(embed, { name: value });
   return { ok: true, embed };

  case EmbedProperty.FooterText:
   setFooterPart(embed, { text: value });
   return { ok: true, embed };

  case EmbedProperty.Color: {
   if (!value) {
    delete embed.color;
    return { ok: true, embed };
   }
   const color = parseColor(value);
   if (color === null) return { ok: false, error: ApplyErrorCode.InvalidColor };
   embed.color = color;
   return { ok: true, embed };
  }

  case EmbedProperty.Timestamp: {
   if (!value) {
    delete embed.timestamp;
    return { ok: true, embed };
   }
   const timestamp = parseTimestamp(value);
   if (!timestamp) return { ok: false, error: ApplyErrorCode.InvalidTimestamp };
   embed.timestamp = timestamp;
   return { ok: true, embed };
  }

  case EmbedProperty.Url:
  case EmbedProperty.Image:
  case EmbedProperty.Thumbnail:
  case EmbedProperty.AuthorIcon:
  case EmbedProperty.AuthorUrl:
  case EmbedProperty.FooterIcon: {
   if (!value) return applyUrlProperty(embed, property, null);
   const url = parseUrl(value);
   if (!url) return { ok: false, error: ApplyErrorCode.InvalidUrl };
   return applyUrlProperty(embed, property, url);
  }

  case EmbedProperty.FieldName:
  case EmbedProperty.FieldValue:
  case EmbedProperty.FieldInline:
   return applyFieldProperty(embed, property, value, fieldIndex);

  default:
   return { ok: true, embed };
 }
};

export const currentValue = (
 embed: APIEmbed,
 property: EmbedProperty,
 fieldIndex: number | null,
): string => {
 switch (property) {
  case EmbedProperty.Title:
   return embed.title ?? '';
  case EmbedProperty.Description:
   return embed.description ?? '';
  case EmbedProperty.Url:
   return embed.url ?? '';
  case EmbedProperty.Image:
   return embed.image?.url ?? '';
  case EmbedProperty.Thumbnail:
   return embed.thumbnail?.url ?? '';
  case EmbedProperty.AuthorName:
   return embed.author?.name === blank ? '' : (embed.author?.name ?? '');
  case EmbedProperty.AuthorIcon:
   return embed.author?.icon_url ?? '';
  case EmbedProperty.AuthorUrl:
   return embed.author?.url ?? '';
  case EmbedProperty.FooterText:
   return embed.footer?.text === blank ? '' : (embed.footer?.text ?? '');
  case EmbedProperty.FooterIcon:
   return embed.footer?.icon_url ?? '';
  case EmbedProperty.Color:
   return typeof embed.color === 'number'
    ? `#${embed.color.toString(16).padStart(6, '0')}`
    : '';
  case EmbedProperty.Timestamp:
   return embed.timestamp ?? '';
  case EmbedProperty.FieldName: {
   const name = fieldIndex !== null ? (embed.fields?.[fieldIndex]?.name ?? '') : '';
   return name === blank ? '' : name;
  }
  case EmbedProperty.FieldValue: {
   const value = fieldIndex !== null ? (embed.fields?.[fieldIndex]?.value ?? '') : '';
   return value === blank ? '' : value;
  }
  default:
   return '';
 }
};
