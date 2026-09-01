export enum MessagePlaceholder {
 User = 'user',
 Username = 'username',
 Displayname = 'displayname',
 Server = 'server',
 Membercount = 'membercount',
 Gif = 'gif',
 Days = 'days',
}

export const basePlaceholders = [
 MessagePlaceholder.User,
 MessagePlaceholder.Username,
 MessagePlaceholder.Displayname,
 MessagePlaceholder.Server,
 MessagePlaceholder.Membercount,
];

export const placeholderDoc = (...extra: MessagePlaceholder[]): string =>
 [...basePlaceholders, ...extra].map((p) => `\`{{${p}}}\``).join(' ');
