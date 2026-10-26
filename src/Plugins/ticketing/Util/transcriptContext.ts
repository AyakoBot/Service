/* eslint-disable @typescript-eslint/naming-convention */
import { ComponentType } from 'discord-api-types/v10';

export enum TicketContextType {
 Created = 'created',
 Forwarded = 'forwarded',
 Internal = 'internal',
 Claimed = 'claimed',
 Unclaimed = 'unclaimed',
 Closed = 'closed',
 Left = 'left',
 Escalated = 'escalated',
}

export interface TicketContext {
 type: TicketContextType;
 actorId: string;
 refId: string;
}

const types = new Set<string>(Object.values(TicketContextType));

export const encodeContext = (type: TicketContextType, actorId: string, refId: string = '0') =>
 `tickctx_${type}_${actorId || '0'}_${refId || '0'}`;

export const decodeContext = (customId?: string | null): TicketContext | null => {
 if (!customId || !customId.startsWith('tickctx_')) return null;

 const [, type, actorId, refId] = customId.split('_');
 if (!type || !types.has(type)) return null;

 return { type: type as TicketContextType, actorId: actorId || '', refId: refId || '' };
};

const contextParam = 'tickctx';

export const withContext = (imageUrl: string, context: string) => {
 const url = new URL(imageUrl);
 url.searchParams.set('size', '1024');
 url.searchParams.set(contextParam, context);

 return url.toString();
};

const contextFromUrl = (raw?: string): TicketContext | null => {
 if (!raw) return null;

 try {
  return decodeContext(new URL(raw).searchParams.get(contextParam));
 } catch {
  return null;
 }
};

interface RawComponent {
 type?: number;
 custom_id?: string;
 content?: string;
 media?: { url?: string };
 components?: unknown;
 accessory?: RawComponent;
}

const contextOf = (component: RawComponent): TicketContext | null => {
 if (component.type === ComponentType.Button) return decodeContext(component.custom_id);
 if (component.type === ComponentType.Thumbnail) return contextFromUrl(component.media?.url);

 return null;
};

const walk = (components: unknown, visit: (component: RawComponent) => void) => {
 if (!Array.isArray(components)) return;

 for (const entry of components) {
  if (!entry || typeof entry !== 'object') continue;

  const component = entry as RawComponent;
  visit(component);
  walk(component.components, visit);
  if (component.accessory) walk([component.accessory], visit);
 }
};

export const findContext = (components: unknown): TicketContext | null => {
 let found: TicketContext | null = null;

 walk(components, (component) => {
  if (found) return;

  const context = contextOf(component);
  if (context) found = context;
 });

 return found;
};

export const findMessageRef = (components: unknown, refId: string): boolean => {
 let hit = false;

 walk(components, (component) => {
  if (hit) return;

  if (contextOf(component)?.refId === refId) hit = true;
 });

 return hit;
};

const isMarkerHeader = (component: RawComponent) =>
 component.type === ComponentType.Section &&
 component.accessory?.type === ComponentType.Thumbnail &&
 !!contextOf(component.accessory);

const headerTexts = (components: unknown) => {
 const authors = new Set<RawComponent>();
 const besides = new Set<RawComponent>();

 walk(components, (component) => {
  if (!isMarkerHeader(component) || !Array.isArray(component.components)) return;

  const [author, beside] = component.components as RawComponent[];
  if (author) authors.add(author);
  if (beside) besides.add(beside);
 });

 return { authors, besides };
};

export const extractBody = (components: unknown): string => {
 const { authors, besides } = headerTexts(components);
 const parts: string[] = [];
 let continues = false;

 walk(components, (component) => {
  if (component.type !== ComponentType.TextDisplay || typeof component.content !== 'string') return;

  const joins = continues;
  continues = false;

  const text = component.content.trim();
  if (!text || authors.has(component) || /^(> )?-#/.test(text)) return;

  if (joins && parts.length) parts[parts.length - 1] += ` ${text}`;
  else parts.push(text);
  continues = besides.has(component);
 });

 return parts.join('\n');
};

export const hasActionButton = (components: unknown, prefixes: string[]): boolean => {
 let hit = false;

 walk(components, (component) => {
  if (hit || component.type !== ComponentType.Button) return;

  const id = component.custom_id;
  if (id && prefixes.some((prefix) => id.startsWith(prefix))) hit = true;
 });

 return hit;
};
