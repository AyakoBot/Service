/* eslint-disable @typescript-eslint/naming-convention */

enum TicketErrors1 {
 ticketNotFound = 'ticketNotFound',
 userNotFound = 'userNotFound',
}

export const BaseTicketLoggerErrors = { ...TicketErrors1 } as const;

enum TicketErrors2 {
 claim_TicketAlreadyClosed = 'claim.ticketAlreadyClosed',
 claim_TicketAlreadyClaimed = 'claim.ticketAlreadyClaimed',
 claim_CreatorCannotClaim = 'claim.creatorCannotClaim',
 claim_UserNotStaff = 'claim.userNotStaff',
 claim_TicketNotOpened = 'claim.ticketNotOpened',

 delete_TicketNotFound = 'delete.ticketNotFound',
 delete_OnlyStaffCanDelete = 'delete.onlyStaffCanDelete',
 delete_TicketNotClosed = 'delete.ticketNotClosed',

 create_TicketExists = 'create.ticketExists',
 create_SettingsNotFound = 'create.settingsNotFound',
 create_SettingsChannelNotFound = 'create.settingsChannelNotFound',
 create_SettingsInactive = 'create.settingsInactive',
 create_UserDenied = 'create.userDenied',
 create_RoleDenied = 'create.roleDenied',
 create_DBEntryFailed = 'create.dbEntryFailed',

 close_TicketAlreadyClosed = 'close.ticketAlreadyClosed',
 close_UserNotStaff = 'close.userNotStaff',

 unknownTicketType = 'unknownTicketType',
}

export const BaseTicketErrors = { ...TicketErrors2, ...BaseTicketLoggerErrors } as const;

enum TicketErrors3 {
 channelNotFound = 'channelNotFound',
 badChannelSupplied = 'badChannelSupplied',

 create_CantCreateChannel = 'create.cantCreateChannel',
 create_CantUpdatePermissions = 'create.cantUpdatePermissions',
 create_CantSendInitMessage = 'create.cantSendInitMessage',
 create_cantReplyMessage = 'create.cantReplyMessage',

 claim_CantEditChannel = 'claim.cantEditChannel',
 claim_CantEditMessage = 'claim.cantEditMessage',

 close_CantEditInitMessage = 'close.cantEditInitMessage',
 close_CantEditChannel = 'close.cantEditChannel',
 close_CantReplyMessage = 'close.cantReplyMessage',

 delete_cantUpdateMessage = 'delete.cantUpdateMessage',
 delete_cantDeleteChannel = 'delete.cantDeleteChannel',
}

export const ChannelTicketErrors = { ...BaseTicketErrors, ...TicketErrors3 } as const;

enum TicketErrors4 {
 ticketPluginNotFound = 'ticketPluginNotFound',
 unknownTicketType = 'unknownTicketType',
 dmChannelNotFound = 'dmChannelNotFound',
 couldntSendDm = 'couldntSendDm',
}

export const DMTicketErrors = { ...TicketErrors4, ...ChannelTicketErrors } as const;

enum TicketErrors5 {
 threadNotFound = 'threadNotFound',
 threadChannelNotSet = 'threadChannelNotSet',
}

export const ThreadTicketErrors = { ...TicketErrors5, ...ChannelTicketErrors } as const;
