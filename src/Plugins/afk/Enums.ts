export enum AfkCommand {
 Afk = 'afk',
 Unafk = 'unafk',
}

export enum AfkModSub {
 List = 'list',
 Clear = 'clear',
 ResetReason = 'reset-reason',
}

export enum AfkOption {
 User = 'user',
 Reason = 'reason',
 Page = 'page',
}

export enum AfkGroups {
 General = 'general',
}

export enum AfkRoute {
 Restore = 'afk/restore',
 DmPings = 'afk/dmPings',
}

export enum AfkKey {
 Notice = 'afk:notice',
 Pings = 'afk:pings',
 Return = 'afk:return',
}

export enum NickSkip {
 TooLong = 'tooLong',
 Owner = 'owner',
 Failed = 'failed',
}
