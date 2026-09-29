export const origin = 'CustomRoles';

export enum CustomRolesKey {
 Reconcile = 'customroles:reconcile',
 Activity = 'customroles:activity',
 Inactivity = 'customroles:inactivity',
 WatchBeat = 'customroles:watch:beat',
 WatchSince = 'customroles:watch:since',
 Observed = 'customroles:observed',
 PresenceThrottle = 'customroles:presence:throttle',
 PresenceBeat = 'customroles:presence:beat',
 PresenceSince = 'customroles:presence:since',
}

export enum CustomRolesReason {
 Grant = 'Custom-Role',
 Manage = 'Custom Roles',
 OwnerLeft = 'Custom-Role Owner left the Server',
 PrivilegeLost = 'Custom-Role Owner lost privilege to own this Role',
 Inactive = 'Custom-Role Owner was inactive',
}

export const reconcileChunkSize = 100;
export const reconcileChunkDelaySeconds = 2;

export const activityThrottleSeconds = 3600;
export const inactivitySweepSeconds = 3600;
export const watchToleranceMs = 3 * 3_600_000;
export const minInactivitySeconds = 86_400;
export const settingsCacheMs = 60_000;
export const presenceThrottleSeconds = 300;
export const presenceToleranceMs = 86_400_000;
