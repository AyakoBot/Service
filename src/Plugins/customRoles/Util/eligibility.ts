import { NO_ROLE_POSITION } from '../../../Util/roleHierarchy.js';
import type { RewardTrigger } from '../../../Util/roleRewards.js';

export {
 applyingRows,
 passesGates,
 sellableRow,
 grantedRows,
 denied,
 digestAction,
 planDigest,
 DigestAction,
 type DigestPlan,
 type RewardTrigger,
} from '../../../Util/roleRewards.js';

export interface RewardRowLike extends RewardTrigger {
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

export interface SharedTruncation {
 kept: string[];
 dropped: string[];
}

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

export const revokeFor = (
 lost: string[],
 allRows: RewardRowLike[],
 applying: RewardRowLike[],
): boolean => {
 const byId = new Map(allRows.map((r) => [r.id, r]));

 return lost.some((id) => byId.get(id)?.customRole === true) && !applying.some((r) => r.customRole);
};

export const truncateShared = (shared: string[], maxShare: number): SharedTruncation => ({
 kept: shared.slice(0, Math.max(0, maxShare)),
 dropped: shared.slice(Math.max(0, maxShare)),
});
