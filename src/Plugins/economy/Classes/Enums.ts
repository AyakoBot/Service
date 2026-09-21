export enum EconomySettingName {
 Rewards = 'economy-rewards',
}

export enum EconomyGroups {
 General = 'general',
 Earning = 'earning',
 Transfers = 'transfers',
 Filters = 'filters',
 Identity = 'identity',
 Rewards = 'rewards',
 Payout = 'payout',
 Recurring = 'recurring',
 Shop = 'shop',
 Panel = 'panel',
}

export enum LedgerReason {
 Message = 'message',
 RoleReward = 'role-reward',
 Purchase = 'purchase',
 TransferOut = 'transfer-out',
 TransferIn = 'transfer-in',
 AdminGive = 'admin-give',
 AdminTake = 'admin-take',
 AdminSet = 'admin-set',
 AdminReset = 'admin-reset',
 Refund = 'refund',
}

export enum SpendResult {
 Ok = 'ok',
 Insufficient = 'insufficient',
 AlreadyOwned = 'already-owned',
 Frozen = 'frozen',
 RolesBlocked = 'roles-blocked',
}

export enum EconomyKey {
 EarnCooldown = 'economy:earn',
}
