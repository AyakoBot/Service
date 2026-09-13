export interface RewardTrigger {
 id: string;
 active: boolean;
 roles: string[];
 denyRoles: string[];
 denyUsers: string[];
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
 write: boolean;
}

export const applyingRows = <T extends RewardTrigger>(
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

export const denied = (rows: RewardTrigger[], memberRoles: string[], userId: string): boolean =>
 rows.some(
  (r) => r.denyUsers.includes(userId) || r.denyRoles.some((id) => memberRoles.includes(id)),
 );

export const digestAction = (rewards: string[], stored: string[] | null): DigestAction => {
 if (stored === null) return DigestAction.Seed;

 const changed =
  rewards.some((id) => !stored.includes(id)) || stored.some((id) => !rewards.includes(id));

 return changed ? DigestAction.Changed : DigestAction.Unchanged;
};

export const planDigest = (applying: RewardTrigger[], stored: string[] | null): DigestPlan => {
 const rewards = applying.map((r) => r.id);
 const action = digestAction(rewards, stored);

 if (action === DigestAction.Seed) {
  return { action, rewards, gained: [], lost: [], write: !!rewards.length };
 }

 const gained = rewards.filter((id) => !(stored ?? []).includes(id));
 const lost = (stored ?? []).filter((id) => !rewards.includes(id));

 if (action === DigestAction.Unchanged) {
  return { action, rewards, gained, lost, write: false };
 }

 return { action, rewards, gained, lost, write: true };
};
