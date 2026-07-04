import {
 ComponentType,
 type APIActionRowComponent,
 type APIButtonComponentWithURL,
 type APIComponentInMessageActionRow,
 type APIMessageTopLevelComponent,
 type APIStringSelectComponent,
} from 'discord-api-types/v10';

import { ComponentBuilderRoute } from '../Classes/Routes.js';

import { stripIds, validateTree, type WipTree } from './componentTree.js';

enum MarkerParam {
 Builder = 'isComponentBuilder',
 Exec = 'exec',
 WebhookName = 'wn',
 WebhookAvatar = 'wa',
}

export enum ChromeComponentId {
 Boundary = 900001,
 Placeholder = 900002,
}

const markerBase = 'https://ayakobot.com/';
export const markerUrlLimit = 512;

export interface BuilderMarker {
 execId: string;
 webhookName?: string;
 webhookAvatar?: string;
}

export interface BuilderMessageLike {
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

const chromeRows = (
 msg: BuilderMessageLike,
): APIActionRowComponent<APIComponentInMessageActionRow>[] => {
 const rows: APIActionRowComponent<APIComponentInMessageActionRow>[] = [];

 for (const component of msg.components ?? []) {
  if (component.type === ComponentType.Separator &&
   component.id === ChromeComponentId.Boundary) {
   break;
  }
  if (component.type === ComponentType.ActionRow) rows.push(component);
 }

 return rows;
};

const markerButton = (msg: BuilderMessageLike): APIButtonComponentWithURL | null => {
 for (const row of chromeRows(msg)) {
  for (const component of row.components) {
   if (component.type !== ComponentType.Button || !('url' in component)) continue;
   try {
    if (new URL(component.url).searchParams.get(MarkerParam.Builder) === 'true') {
     return component;
    }
   } catch {
    continue;
   }
  }
 }
 return null;
};

export const parseMarker = (msg: BuilderMessageLike): BuilderMarker | null => {
 const button = markerButton(msg);
 if (!button) return null;

 const url = new URL(button.url);
 const execId = url.searchParams.get(MarkerParam.Exec);
 if (!execId) return null;

 return {
  execId,
  webhookName: url.searchParams.get(MarkerParam.WebhookName) ?? undefined,
  webhookAvatar: url.searchParams.get(MarkerParam.WebhookAvatar) ?? undefined,
 };
};

export const getWipTree = (msg: BuilderMessageLike): WipTree => {
 const components = msg.components ?? [];
 const boundary = components.findIndex(
  (component) =>
   component.type === ComponentType.Separator &&
   component.id === ChromeComponentId.Boundary,
 );
 if (boundary === -1) return [];

 const wip = components.slice(boundary + 1);
 if (wip.length === 1 && wip[0].id === ChromeComponentId.Placeholder) return [];
 return stripIds(wip);
};

const findSelect = (
 msg: BuilderMessageLike,
 route: ComponentBuilderRoute,
): APIStringSelectComponent | null => {
 for (const row of chromeRows(msg)) {
  for (const component of row.components) {
   if (component.type !== ComponentType.StringSelect) continue;
   if (!component.custom_id.startsWith(route)) continue;
   return component;
  }
 }
 return null;
};

export const getSelectedPath = (msg: BuilderMessageLike): string | null => {
 const select = findSelect(msg, ComponentBuilderRoute.Node);
 const value = select?.options.find((option) => option.default)?.value ?? null;
 if (value === null || !/^[\d.a]+$/.test(value)) return null;
 return value;
};

export const isSendable = (tree: WipTree): boolean =>
 tree.length > 0 && validateTree(tree) === null;
