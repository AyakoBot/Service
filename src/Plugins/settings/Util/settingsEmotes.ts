import type { APIPartialEmoji } from '@discordjs/core';
import type { APIMessageComponentEmoji } from 'discord-api-types/v10';

import type { EditorType } from '../EditorType.js';

export interface EmoteProvider {
 getEmoteForGroup(groupId: string): APIPartialEmoji;
 getEmoteForEditor(editor: EditorType, value: unknown): APIPartialEmoji;
}

export const buttonEmoji = (emote: APIPartialEmoji): APIMessageComponentEmoji => {
 if (emote.id) {
  return { id: emote.id, name: emote.name || undefined, animated: emote.animated };
 }
 return { ...emote, name: emote.name || undefined, id: undefined };
};

export const textEmote = (emote: APIPartialEmoji): string => {
 if (emote.id) {
  return `<${emote.animated ? 'a' : ''}:${emote.name}:${emote.id}>`;
 }
 return emote.name || '';
};
