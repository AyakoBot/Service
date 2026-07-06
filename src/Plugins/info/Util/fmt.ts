import type { APIPartialEmoji } from '@discordjs/core';

import type { BaseLang } from '../../../Classes/abstracts/Plugin.js';
import constants from '../../../Classes/Constants.js';
import emotes from '../../../Classes/Emotes.js';

export const containerCharBudget = 3500;

export const line = (emote: APIPartialEmoji, label: string, value: string): string =>
 `${constants.formatters.getEmote(emote)} **${label}:** ${value}`;

export const subLine = (label: string, value: string): string => `-# ${label}: ${value}`;

export const yesNo = (base: BaseLang, value: boolean): string =>
 `${constants.formatters.getEmote(value ? emotes.enabled : emotes.disabled)} ${
  value ? base.t.Yes() : base.t.No()
 }`;

export const codeId = (id: string): string => `\`${id}\``;

export const timeOf = (ms: number | null, base: BaseLang): string =>
 (ms === null ? base.t.Unknown() : constants.formatters.getTime(ms));

export const nameOf = (
 map: unknown,
 key: number | string | null | undefined,
 fallback: string,
): string => {
 const lookup = (map as Record<string, () => string>)[String(key)];
 return lookup ? lookup() : fallback;
};

export const chunkByLength = (lines: string[], budget: number = containerCharBudget): string[] => {
 const chunks: string[] = [];
 let current: string[] = [];
 let length = 0;

 for (const entry of lines) {
  if (length + entry.length + 1 > budget && current.length) {
   chunks.push(current.join('\n'));
   current = [];
   length = 0;
  }
  current.push(entry);
  length += entry.length + 1;
 }
 if (current.length) chunks.push(current.join('\n'));

 return chunks.length ? chunks : [''];
};
