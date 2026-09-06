/* eslint-disable @typescript-eslint/naming-convention */

enum TicketErrors1 {
 ticketNotFound = 'ticketNotFound',
 userNotFound = 'userNotFound',
 memberNotFound = 'memberNotFound',
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
 create_LimitKindReached = 'create.limitKindReached',
 create_LimitTotalReached = 'create.limitTotalReached',

 close_TicketAlreadyClosed = 'close.ticketAlreadyClosed',
 close_UserNotStaff = 'close.userNotStaff',

 unclaim_TicketNotClaimed = 'unclaim.ticketNotClaimed',
 unclaim_UserNotStaff = 'unclaim.userNotStaff',

 take_TicketNotClaimed = 'take.ticketNotClaimed',
 take_AlreadyClaimer = 'take.alreadyClaimer',
 take_NotAllowed = 'take.notAllowed',

 escalate_TicketClosed = 'escalate.ticketClosed',
 escalate_UserNotStaff = 'escalate.userNotStaff',
 escalate_TierNotFound = 'escalate.tierNotFound',
 escalate_CannotReach = 'escalate.cannotReach',
 escalate_NoTiers = 'escalate.noTiers',

 unknownTicketType = 'unknownTicketType',
 settingsNotFound = 'settingsNotFound',
}

export const BaseTicketErrors = { ...TicketErrors2, ...BaseTicketLoggerErrors } as const;

enum TicketErrors3 {
 channelNotFound = 'channelNotFound',
 badChannelSupplied = 'badChannelSupplied',
 cantSendMessage = 'cantSendMessage',

 create_CantCreateChannel = 'create.cantCreateChannel',
 create_CantUpdatePermissions = 'create.cantUpdatePermissions',
 create_CategoryNotSet = 'create.categoryNotSet',
 create_CantReplyMessage = 'create.cantReplyMessage',

 claim_CantEditChannel = 'claim.cantEditChannel',
 claim_CantEditMessage = 'claim.cantEditMessage',

 close_CantEditInitMessage = 'close.cantEditInitMessage',
 close_CantEditChannel = 'close.cantEditChannel',
 close_CantReplyMessage = 'close.cantReplyMessage',

 delete_CantUpdateMessage = 'delete.cantUpdateMessage',
 delete_CantDeleteChannel = 'delete.cantDeleteChannel',
}

export const ChannelTicketErrors = { ...BaseTicketErrors, ...TicketErrors3 } as const;

enum TicketErrors4 {
 ticketPluginNotFound = 'ticketPluginNotFound',
 unknownTicketType = 'unknownTicketType',
 dmChannelNotFound = 'dmChannelNotFound',
 couldntSendDm = 'couldntSendDm',

 create_UserAlreadyInDmTicket = 'create.userAlreadyInDmTicket',
 create_CantCreateDMChannel = 'create.cantCreateDMChannel',
 create_CantGenerateMessageUrlNoDm = 'create.cantGenerateMessageUrlNoDm',
}

export const DMTicketErrors = { ...TicketErrors4, ...ChannelTicketErrors } as const;

enum TicketErrors5 {
 threadNotFound = 'threadNotFound',
 threadChannelNotSet = 'threadChannelNotSet',
}

export const ThreadTicketErrors = { ...TicketErrors5, ...ChannelTicketErrors } as const;

export enum SnippetErrors {
 noTicket = 'snippet.noTicket',
 notFound = 'snippet.notFound',
 emptySnippet = 'snippet.emptySnippet',
 nameRequired = 'snippet.nameRequired',
}

export enum TierErrors {
 notFound = 'tier.notFound',
 forumTagBudget = 'tier.forumTagBudget',
 nameRequired = 'tier.nameRequired',
 noReachableTiers = 'tier.noReachableTiers',
 tierNotFound = 'tier.tierNotFound',
 cannotReach = 'tier.cannotReach',
}

export enum MoveDirection {
 Up = 'up',
 Down = 'down',
}

export enum PageDirection {
 Prev = 'prev',
 Next = 'next',
}

export enum TicketThreadPrefix {
 Log = 'log-',
 Staff = 'staff-',
}
