import {
 ComponentType,
 type APIActionRowComponent,
 type APIButtonComponent,
 type APIButtonComponentWithURL,
 type APIComponentInMessageActionRow,
 type APIMessageTopLevelComponent,
 type APIStringSelectComponent,
} from 'discord-api-types/v10';

import { ComponentBuilderRoute } from '../Classes/Routes.js';

import { stripIds, validateTree, type BoundCheck, type WipTree } from './componentTree.js';

enum MarkerParam {
 Builder = 'isComponentBuilder',
 Exec = 'exec',
 Design = 'dm',
 WebhookName = 'wn',
 WebhookAvatar = 'wa',
}

export enum ChromeComponentId {
 Placeholder = 900002,
}

const markerBase = 'https://ayakobot.com/';
export const markerUrlLimit = 512;

export interface BuilderMarker {
 execId: string;
 designId?: string;
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
 if (marker.designId) url.searchParams.set(MarkerParam.Design, marker.designId);
 if (marker.webhookName) url.searchParams.set(MarkerParam.WebhookName, marker.webhookName);
 if (marker.webhookAvatar) url.searchParams.set(MarkerParam.WebhookAvatar, marker.webhookAvatar);
 return url.toString();
};

const chromeComponents = (msg: BuilderMessageLike): APIMessageTopLevelComponent[] =>
 msg.components ?? [];

const chromeRows = (
 msg: BuilderMessageLike,
): APIActionRowComponent<APIComponentInMessageActionRow>[] =>
 chromeComponents(msg).filter(
  (component): component is APIActionRowComponent<APIComponentInMessageActionRow> =>
   component.type === ComponentType.ActionRow,
 );

const chromeButtons = (msg: BuilderMessageLike): APIButtonComponent[] =>
 chromeComponents(msg).flatMap((component) => {
  if (component.type === ComponentType.ActionRow) {
   return component.components.filter(
    (child): child is APIButtonComponent => child.type === ComponentType.Button,
   );
  }
  if (
   component.type === ComponentType.Section &&
   component.accessory.type === ComponentType.Button
  ) {
   return [component.accessory];
  }
  return [];
 });

const markerButton = (msg: BuilderMessageLike): APIButtonComponentWithURL | null => {
 for (const component of chromeButtons(msg)) {
  if (!('url' in component)) continue;
  try {
   if (new URL(component.url).searchParams.get(MarkerParam.Builder) === 'true') {
    return component;
   }
  } catch {
   continue;
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
  designId: url.searchParams.get(MarkerParam.Design) ?? undefined,
  webhookName: url.searchParams.get(MarkerParam.WebhookName) ?? undefined,
  webhookAvatar: url.searchParams.get(MarkerParam.WebhookAvatar) ?? undefined,
 };
};

export const getWipTree = (msg: BuilderMessageLike): WipTree => {
 const components = msg.components ?? [];
 if (components.length === 1 && components[0]?.id === ChromeComponentId.Placeholder) return [];
 return stripIds(components);
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

const nodePageArg = (msg: BuilderMessageLike): string | undefined => {
 const select = findSelect(msg, ComponentBuilderRoute.Node);
 if (select) return select.custom_id.split('_')[1];

 return chromeButtons(msg)
  .map((button) => ('custom_id' in button ? button.custom_id : ''))
  .find((customId) => customId.startsWith(ComponentBuilderRoute.Back))
  ?.split('_')[2];
};

export const getNodePage = (msg: BuilderMessageLike): number => {
 const page = Number(nodePageArg(msg));
 return Number.isInteger(page) && page > 0 ? page : 0;
};

export const isSendable = (tree: WipTree, isBound?: BoundCheck): boolean =>
 tree.length > 0 && validateTree(tree, isBound) === null;
