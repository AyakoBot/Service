export enum MessagePlaceholder {
 User = 'user',
 Username = 'username',
 Displayname = 'displayname',
 UserId = 'userid',
 UserAvatar = 'useravatar',
 UserCreated = 'usercreated',

 Server = 'server',
 ServerId = 'serverid',
 ServerIcon = 'servericon',
 Membercount = 'membercount',
 BoostCount = 'boostcount',
 BoostTier = 'boosttier',

 Gif = 'gif',
 Days = 'days',
}

export const serverPlaceholders = [
 MessagePlaceholder.Server,
 MessagePlaceholder.ServerId,
 MessagePlaceholder.ServerIcon,
 MessagePlaceholder.Membercount,
 MessagePlaceholder.BoostCount,
 MessagePlaceholder.BoostTier,
];

export const memberPlaceholders = [
 MessagePlaceholder.User,
 MessagePlaceholder.Username,
 MessagePlaceholder.Displayname,
 MessagePlaceholder.UserId,
 MessagePlaceholder.UserAvatar,
 MessagePlaceholder.UserCreated,
];

export const basePlaceholders = [...memberPlaceholders, ...serverPlaceholders];

export const withBasePlaceholders = (...extra: MessagePlaceholder[]): MessagePlaceholder[] => [
 ...basePlaceholders,
 ...extra,
];

export const withServerPlaceholders = (...extra: MessagePlaceholder[]): MessagePlaceholder[] => [
 ...serverPlaceholders,
 ...extra,
];

export const renderPlaceholderList = (placeholders: MessagePlaceholder[]): string =>
 placeholders.map((p) => `\`{{${p}}}\``).join(' ');

export const placeholderDoc = (...extra: MessagePlaceholder[]): string =>
 renderPlaceholderList(withBasePlaceholders(...extra));
