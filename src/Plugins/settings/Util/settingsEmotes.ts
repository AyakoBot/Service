import type { APIPartialEmoji } from '@discordjs/core';
import type { APIMessageComponentEmoji } from 'discord-api-types/v10';

export const buttonEmoji = (emote: APIPartialEmoji): APIMessageComponentEmoji => {
 if (emote.id) {
  return { id: emote.id, name: emote.name || undefined, animated: emote.animated };
 }
 if (emote.name && /^\w+$/.test(emote.name)) return { name: '❔' };
 return { ...emote, name: emote.name || undefined, id: undefined };
};

export const textEmote = (emote: APIPartialEmoji): string => {
 if (emote.id) {
  return `<${emote.animated ? 'a' : ''}:${emote.name}:${emote.id}>`;
 }
 return emote.name || '';
};
