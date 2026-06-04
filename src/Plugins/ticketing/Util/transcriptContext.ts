/* eslint-disable @typescript-eslint/naming-convention */
import { ComponentType } from 'discord-api-types/v10';

export enum TicketContextType {
 Created = 'created',
 Forwarded = 'forwarded',
 Internal = 'internal',
 Claimed = 'claimed',
 Closed = 'closed',
}

export interface TicketContext {
 type: TicketContextType;
 actorId: string;
 refId: string;
}

const PREFIX = 'tickctx';
const TYPES = new Set<string>(Object.values(TicketContextType));

export const encodeContext = (type: TicketContextType, actorId: string, refId: string = '0') =>
 `${PREFIX}_${type}_${actorId || '0'}_${refId || '0'}`;

export const decodeContext = (customId?: string | null): TicketContext | null => {
 if (!customId || !customId.startsWith(`${PREFIX}_`)) return null;

 const [, type, actorId, refId] = customId.split('_');
 if (!type || !TYPES.has(type)) return null;

 return { type: type as TicketContextType, actorId: actorId || '', refId: refId || '' };
};

interface RawComponent {
 type?: number;
 custom_id?: string;
 content?: string;
 components?: unknown;
 accessory?: RawComponent;
}

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
  if (found || component.type !== ComponentType.Button) return;

  const context = decodeContext(component.custom_id);
  if (context) found = context;
 });

 return found;
};

export const findMessageButtonRef = (components: unknown, refId: string): boolean => {
 let hit = false;

 walk(components, (component) => {
  if (hit || component.type !== ComponentType.Button) return;

  const context = decodeContext(component.custom_id);
  if (context?.refId === refId) hit = true;
 });

 return hit;
};

export const extractBody = (components: unknown): string => {
 const parts: string[] = [];

 walk(components, (component) => {
  if (component.type !== ComponentType.TextDisplay || typeof component.content !== 'string') return;

  const text = component.content.trim();
  if (text && !text.startsWith('-#')) parts.push(text);
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
