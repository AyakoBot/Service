export const mentionPrefix = /^<@!?(\d{15,})>$/;

export const matchPrefix = (prefix: string, content: string): string | undefined => {
 const mention = mentionPrefix.exec(prefix);
 if (mention) return new RegExp(String.raw`^<@!?${mention[1]}>\s*`).exec(content)?.[0];

 return content.toLowerCase().startsWith(prefix.toLowerCase()) ? prefix : undefined;
};
