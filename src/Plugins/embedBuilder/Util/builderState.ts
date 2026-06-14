import {
 ComponentType,
 type APIActionRowComponent,
 type APIComponentInMessageActionRow,
 type APIEmbed,
 type APIMessageTopLevelComponent,
 type APIStringSelectComponent,
} from 'discord-api-types/v10';

import { EmbedProperty } from '../Classes/Properties.js';
import { EmbedBuilderRoute } from '../Classes/Routes.js';

import { blank } from './applyProperty.js';

enum MarkerParam {
 Builder = 'isEmbedBuilder',
 Exec = 'exec',
 WebhookName = 'wn',
 WebhookAvatar = 'wa',
 Placeholder = 'builderPlaceholder',
}

const markerBase = 'https://ayakobot.com/';

export const placeholderUrl = (): string => {
 const url = new URL(markerBase);
 url.searchParams.set(MarkerParam.Placeholder, 'true');
 return url.toString();
};

const isPlaceholder = (embed: APIEmbed): boolean => {
 if (!embed.url) return false;
 try {
  return new URL(embed.url).searchParams.get(MarkerParam.Placeholder) === 'true';
 } catch {
  return false;
 }
};

export interface BuilderMarker {
 execId: string;
 webhookName?: string;
 webhookAvatar?: string;
}

export interface BuilderMessageLike {
 embeds?: APIEmbed[];
 components?: APIMessageTopLevelComponent[];
}

export const buildMarkerUrl = (marker: BuilderMarker): string => {
 const url = new URL(markerBase);
 url.searchParams.set(MarkerParam.Builder, 'true');
 url.searchParams.set(MarkerParam.Exec, marker.execId);
 if (marker.webhookName) url.searchParams.set(MarkerParam.WebhookName, marker.webhookName);
 if (marker.webhookAvatar) url.searchParams.set(MarkerParam.WebhookAvatar, marker.webhookAvatar);
 return url.toString();
};

export const parseMarker = (msg: BuilderMessageLike): BuilderMarker | null => {
 const raw = msg.embeds?.[0]?.url;
 if (!raw) return null;

 let url: URL;
 try {
  url = new URL(raw);
 } catch {
  return null;
 }

 if (url.searchParams.get(MarkerParam.Builder) !== 'true') return null;
 const execId = url.searchParams.get(MarkerParam.Exec);
 if (!execId) return null;

 return {
  execId,
  webhookName: url.searchParams.get(MarkerParam.WebhookName) ?? undefined,
  webhookAvatar: url.searchParams.get(MarkerParam.WebhookAvatar) ?? undefined,
 };
};

export const getWipEmbed = (msg: BuilderMessageLike): APIEmbed => {
 const embed = msg.embeds?.[1];
 if (!embed || isPlaceholder(embed)) return {};
 const clone = structuredClone(embed);
 if (clone.description === blank) delete clone.description;
 return clone;
};

const findSelect = (
 msg: BuilderMessageLike,
 route: EmbedBuilderRoute,
): APIStringSelectComponent | null => {
 for (const row of msg.components ?? []) {
  if (row.type !== ComponentType.ActionRow) continue;
  const rowComponents = (row as APIActionRowComponent<APIComponentInMessageActionRow>)
   .components;
  for (const component of rowComponents) {
   if (component.type !== ComponentType.StringSelect) continue;
   if (!component.custom_id.startsWith(route)) continue;
   return component;
  }
 }
 return null;
};

const selectedValue = (select: APIStringSelectComponent | null): string | null =>
 select?.options.find((option) => option.default)?.value ?? null;

export const getSelectedField = (msg: BuilderMessageLike): number | null => {
 const value = selectedValue(findSelect(msg, EmbedBuilderRoute.Field));
 if (value === null || !/^\d+$/.test(value)) return null;
 return Number(value);
};

export const getSelectedProperty = (msg: BuilderMessageLike): EmbedProperty | null => {
 const value = selectedValue(findSelect(msg, EmbedBuilderRoute.Property));
 if (!value) return null;
 return (Object.values(EmbedProperty) as string[]).includes(value)
  ? (value as EmbedProperty)
  : null;
};

export const isSendable = (embed: APIEmbed): boolean =>
 Boolean(
  embed.title ||
   embed.description ||
   embed.author?.name ||
   embed.thumbnail?.url ||
   embed.image?.url ||
   embed.footer?.text ||
   embed.fields?.length,
 );
