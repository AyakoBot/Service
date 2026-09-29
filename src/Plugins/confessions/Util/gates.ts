export enum GateFailure {
 Banned = 'banned',
 Blocked = 'blocked',
 AccountTooNew = 'accountTooNew',
 MemberTooNew = 'memberTooNew',
 Cooldown = 'cooldown',
 TooShort = 'tooShort',
 TooLong = 'tooLong',
 InvalidMedia = 'invalidMedia',
 DailyLimit = 'dailyLimit',
}

export interface GateInput {
 now: number;
 banned: boolean;
 blocked: boolean;
 accountCreated: number;
 memberJoined: number;
 minAccountAge: number;
 minMemberAge: number;
 onCooldown: boolean;
 length: number;
 minLength: number;
 maxLength: number;
 mediaValid: boolean;
 recentCount: number;
 maxPerDay: number;
}

export interface LengthBounds {
 min: number;
 max: number;
}

export const contentLimit = 3800;

export const discordEpoch = 1420070400000;

export const snowflakeCreatedAt = (id: string): number =>
 Number(BigInt(id) >> 22n) + discordEpoch;

export const banIsActive = (ban: { until: Date | null } | null, now: number): boolean => {
 if (!ban) return false;
 if (!ban.until) return true;

 return ban.until.getTime() > now;
};

const whole = (value: number, fallback: number): number =>
 Number.isFinite(value) ? Math.trunc(value) : fallback;

export const lengthBounds = (minLength: number, maxLength: number): LengthBounds => {
 const max = Math.min(Math.max(whole(maxLength, contentLimit), 1), contentLimit);

 return { min: Math.min(Math.max(whole(minLength, 1), 1), max), max };
};

export const checkGates = (input: GateInput): GateFailure | null => {
 if (input.banned) return GateFailure.Banned;
 if (input.blocked) return GateFailure.Blocked;

 if (input.minAccountAge > 0 && input.now - input.accountCreated < input.minAccountAge * 1000) {
  return GateFailure.AccountTooNew;
 }

 if (input.minMemberAge > 0 && input.now - input.memberJoined < input.minMemberAge * 1000) {
  return GateFailure.MemberTooNew;
 }

 if (input.onCooldown) return GateFailure.Cooldown;
 if (input.length < input.minLength) return GateFailure.TooShort;
 if (input.length > input.maxLength) return GateFailure.TooLong;
 if (!input.mediaValid) return GateFailure.InvalidMedia;
 if (input.maxPerDay > 0 && input.recentCount >= input.maxPerDay) return GateFailure.DailyLimit;

 return null;
};
