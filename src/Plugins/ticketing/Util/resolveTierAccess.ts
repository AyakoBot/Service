import type { Ticket, TicketSetting, TicketTier } from '@ayako/database';

import type Client from '../../../Classes/Client.js';

type TicketRow = Ticket & { settings: TicketSetting };

const heldRoles = async function (
 this: Client,
 guildId: string,
 userId: string,
): Promise<Set<string>> {
 const member = await this.cache.members.get(guildId, userId);
 return new Set(member?.roles ?? []);
};

const isBaselineStaff = (settings: TicketSetting, userId: string, roles: Set<string>): boolean =>
 settings.staffUsers.includes(userId) || settings.staffRoles.some((role) => roles.has(role));

const tierRankOf = (tiers: TicketTier[], roles: Set<string>): number | null => {
 let best: number | null = null;
 for (const tier of tiers) {
  if (tier.claimRoles.some((role) => roles.has(role))) {
   best = best === null ? tier.rank : Math.max(best, tier.rank);
  }
 }
 return best;
};

const staffTierRankOf = (settings: TicketSetting, roles: Set<string>): number => {
 let best = -1;
 settings.staffTierRoles.forEach((role, index) => {
  if (roles.has(role)) best = Math.max(best, index);
 });
 return best;
};

const userSeniority = (
 settings: TicketSetting,
 tiers: TicketTier[],
 roles: Set<string>,
): number => Math.max(tierRankOf(tiers, roles) ?? -1, staffTierRankOf(settings, roles));

export const canUserTakeClaim = async function (
 this: Client,
 ticket: TicketRow,
 takerId: string,
 tiers: TicketTier[],
): Promise<boolean> {
 if (!ticket.settings.allowTakeClaim) return false;
 if (!ticket.claimer || ticket.claimer === takerId) return false;

 const takerRoles = await heldRoles.call(this, ticket.settings.guild, takerId);
 if (!isBaselineStaff(ticket.settings, takerId, takerRoles)) return false;

 const claimerRoles = await heldRoles.call(this, ticket.settings.guild, ticket.claimer);

 const takerSeniority = userSeniority(ticket.settings, tiers, takerRoles);
 const claimerSeniority = userSeniority(ticket.settings, tiers, claimerRoles);

 return takerSeniority > claimerSeniority;
};

export const canUserReachTier = async function (
 this: Client,
 ticket: TicketRow,
 userId: string,
 target: TicketTier,
 tiers: TicketTier[],
): Promise<boolean> {
 const roles = await heldRoles.call(this, ticket.settings.guild, userId);

 if (target.claimRoles.some((role) => roles.has(role))) return true;

 const seniority = tierRankOf(tiers, roles);
 if (seniority !== null && seniority >= target.rank) return true;

 if (isBaselineStaff(ticket.settings, userId, roles)) {
  const entryRank = tiers.length ? tiers[0].rank : target.rank;
  if (target.rank <= entryRank) return true;
 }

 if (ticket.claimer === userId) {
  const currentRank =
   tiers.find((tier) => tier.id.toString() === ticket.tierId?.toString())?.rank ?? -1;
  if (target.rank > currentRank) return true;
 }

 return false;
};

export const reachableTiers = async function (
 this: Client,
 ticket: TicketRow,
 userId: string,
 tiers: TicketTier[],
): Promise<TicketTier[]> {
 const reachable: TicketTier[] = [];
 for (const tier of tiers) {
  if (tier.id.toString() === ticket.tierId?.toString()) continue;
  if (await canUserReachTier.call(this, ticket, userId, tier, tiers)) reachable.push(tier);
 }
 return reachable;
};

export const canUserClaimTier = async function (
 this: Client,
 ticket: TicketRow,
 userId: string,
 tiers: TicketTier[],
): Promise<boolean> {
 const roles = await heldRoles.call(this, ticket.settings.guild, userId);
 if (isBaselineStaff(ticket.settings, userId, roles)) return true;

 if (!tiers.length) return false;

 const current = tiers.find((tier) => tier.id.toString() === ticket.tierId?.toString());
 const requiredRank = current?.rank ?? tiers[0].rank;

 const seniority = tierRankOf(tiers, roles);
 return seniority !== null && seniority >= requiredRank;
};
