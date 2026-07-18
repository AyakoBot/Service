export type ParsedEmoji = { id: string | null; name: string; animated: boolean };

const customEmoji = /^<(?<animated>a?):(?<name>\w{2,32}):(?<id>\d{17,20})>$/;

export const parseEmojiInput = (input: string): ParsedEmoji | null => {
 const trimmed = input.trim();

 const match = trimmed.match(customEmoji);
 if (match?.groups) {
  return { id: match.groups.id, name: match.groups.name, animated: !!match.groups.animated };
 }

 if (/^\p{Extended_Pictographic}/u.test(trimmed)) return { id: null, name: trimmed, animated: false };
 return null;
};

export const emojiCdnUrl = (emoji: ParsedEmoji): string | null =>
 (emoji.id
  ? `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=4096`
  : null);

export const formatEmoji = (emoji: ParsedEmoji): string =>
 (emoji.id ? `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` : emoji.name);
