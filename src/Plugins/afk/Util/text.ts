const previewLimit = 80;

export const flatten = (text: string): string => text.replace(/\s+/g, ' ').trim();

export const previewOf = (text: string): string => {
 const flat = flatten(text);
 return flat.length > previewLimit ? `${flat.slice(0, previewLimit - 1)}…` : flat;
};

export const messageLink = (guild: string, channel: string, message: string): string =>
 `https://discord.com/channels/${guild}/${channel}/${message}`;
