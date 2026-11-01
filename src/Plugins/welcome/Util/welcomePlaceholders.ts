import { mediaPlaceholders } from '../../../Util/mediaPlaceholders.js';

const stringify = (json: unknown) => (json === undefined ? '' : JSON.stringify(json));

export const hasGifPlaceholder = (json: unknown) => /{{\s?gif\s?}}/.test(stringify(json));

const urlSlot = (placeholder: string) =>
 new RegExp(String.raw`"(?:icon_)?url"\s*:\s*"[^"]*{{\s?${placeholder}\s?}}[^"]*"`);

export const mediaInUrlSlot = (json: unknown, placeholder: string) =>
 urlSlot(placeholder).test(stringify(json));

export const unfilledMediaSlot = (json: unknown, vars: Record<string, string>) =>
 mediaPlaceholders.find((placeholder) => !vars[placeholder] && mediaInUrlSlot(json, placeholder)) ??
 null;
