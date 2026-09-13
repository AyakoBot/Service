import { NO_ROLE_POSITION } from '../../../Util/roleHierarchy.js';

export interface RewardRowLike {
 id: string;
 active: boolean;
 roles: string[];
 denyRoles: string[];
 denyUsers: string[];
 customRole: boolean;
 canSetColor: boolean;
 canSetIcon: boolean;
 canSetGradient: boolean;
 canSetHolo: boolean;
 positionRole: string | null;
 maxShare: number;
}

export interface RewardCapabilities {
 customRole: boolean;
 canSetColor: boolean;
 canSetIcon: boolean;
 canSetGradient: boolean;
 canSetHolo: boolean;
 maxShare: number;
}

export enum DigestAction {
 Seed = 'seed',
 Unchanged = 'unchanged',
 Changed = 'changed',
}

export interface DigestPlan {
 action: DigestAction;
 rewards: string[];
 gained: string[];
 lost: string[];
 revoke: boolean;
 write: boolean;
}

export interface SharedTruncation {
 kept: string[];
 dropped: string[];
}

export const applyingRows = <T extends RewardRowLike>(
 rows: T[],
 memberRoles: string[],
 userId: string,
): T[] =>
 rows.filter(
  (r) =>
   r.active &&
   r.roles.some((id) => memberRoles.includes(id)) &&
   !r.denyRoles.some((id) => memberRoles.includes(id)) &&
   !r.denyUsers.includes(userId),
 );

export const denied = (rows: RewardRowLike[], memberRoles: string[], userId: string): boolean =>
 rows.some(
  (r) => r.denyUsers.includes(userId) || r.denyRoles.some((id) => memberRoles.includes(id)),
 );

export const mergeCapabilities = (applying: RewardRowLike[]): RewardCapabilities => ({
 customRole: applying.some((r) => r.customRole),
 canSetColor: applying.some((r) => r.canSetColor),
 canSetIcon: applying.some((r) => r.canSetIcon),
 canSetGradient: applying.some((r) => r.canSetGradient),
 canSetHolo: applying.some((r) => r.canSetHolo),
 maxShare: applying.length ? Math.max(...applying.map((r) => r.maxShare)) : 0,
});

export const selectAnchorRole = (
 applying: RewardRowLike[],
 positionOf: (roleId: string) => number,
): string | null => {
 const anchored = applying
  .filter((r) => !!r.positionRole && positionOf(r.positionRole) > NO_ROLE_POSITION)
  .sort(
   (a, b) =>
    positionOf(String(b.positionRole)) - positionOf(String(a.positionRole)) ||
    a.id.localeCompare(b.id),
  );

 return anchored[0]?.positionRole ?? null;
};

export const digestAction = (rewards: string[], stored: string[] | null): DigestAction => {
 if (stored === null) return DigestAction.Seed;

 const changed =
  rewards.some((id) => !stored.includes(id)) || stored.some((id) => !rewards.includes(id));

 return changed ? DigestAction.Changed : DigestAction.Unchanged;
};

export const planDigest = (
 applying: RewardRowLike[],
 stored: string[] | null,
 allRows: RewardRowLike[],
): DigestPlan => {
 const rewards = applying.map((r) => r.id);
 const action = digestAction(rewards, stored);

 if (action === DigestAction.Seed) {
  return { action, rewards, gained: [], lost: [], revoke: false, write: !!rewards.length };
 }

 const gained = rewards.filter((id) => !(stored ?? []).includes(id));
 const lost = (stored ?? []).filter((id) => !rewards.includes(id));

 if (action === DigestAction.Unchanged) {
  return { action, rewards, gained, lost, revoke: false, write: false };
 }

 const byId = new Map(allRows.map((r) => [r.id, r]));
 const revoke =
  lost.some((id) => byId.get(id)?.customRole === true) && !applying.some((r) => r.customRole);

 return { action, rewards, gained, lost, revoke, write: true };
};

export const truncateShared = (shared: string[], maxShare: number): SharedTruncation => ({
 kept: shared.slice(0, Math.max(0, maxShare)),
 dropped: shared.slice(Math.max(0, maxShare)),
});
