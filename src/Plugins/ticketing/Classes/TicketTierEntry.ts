import type { TicketSetting, TicketTier } from '@ayako/database';
import { TicketPlacementMode } from '@ayako/database';

import DBEntry, { findMany } from '../../../Classes/abstracts/DBEntry.js';
import type Client from '../../../Classes/Client.js';
import type { FindManyArgs } from '../../../Types/prisma.js';

import { MoveDirection, TierErrors } from './Enums.js';

export interface TierInput {
 name: string;
 claimRoles: string[];
 category?: string | null;
 channel?: string | null;
 reminderSeconds?: number;
}

const forumTagCap = 20;

const trunc = (value: string) => value.slice(0, 20);

const lifecycleTagCount = (settings: TicketSetting) =>
 new Set(
  [...settings.createTags, ...settings.claimTags, ...settings.closeTags].map(trunc).filter(Boolean),
 ).size;

export default class TicketTierEntry extends DBEntry<'ticketTier'> {
 settingsId: string;

 constructor(client: Client, settingsId: string) {
  super(client, 'ticketTier', { where: { id: '0' } });
  this.settingsId = settingsId;
 }

 list(): Promise<TicketTier[]> {
  return findMany(this.client, 'ticketTier', {
   where: { settingsId: this.settingsId },
   orderBy: { rank: 'asc' },
  } as FindManyArgs<'ticketTier'>);
 }

 byId(id: string): Promise<TicketTier | null> {
  return this.client.db.client.ticketTier.findUnique({ where: { id } });
 }

 async nextRank(): Promise<number> {
  const tiers = await this.list();
  return tiers.reduce((max, tier) => Math.max(max, tier.rank), -1) + 1;
 }

 async assertForumBudget(settings: TicketSetting, prospectiveNames: string[]): Promise<void> {
  if (settings.placementMode !== TicketPlacementMode.UnifiedForum) return;

  const tierNames = new Set(prospectiveNames.map(trunc).filter(Boolean));
  if (tierNames.size + lifecycleTagCount(settings) > forumTagCap) {
   throw new Error(TierErrors.forumTagBudget);
  }
 }

 async create(settings: TicketSetting, input: TierInput): Promise<TicketTier> {
  const tiers = await this.list();
  const names = [...tiers.map((tier) => tier.name), input.name];
  await this.assertForumBudget(settings, names);

  const rank = await this.nextRank();

  return this.client.db.client.ticketTier.create({
   data: {
    id: String(Date.now()),
    name: input.name,
    rank,
    claimRoles: input.claimRoles,
    category: input.category ?? null,
    channel: input.channel ?? null,
    reminderSeconds: input.reminderSeconds ?? 0,
    settings: { connect: { id: this.settingsId } },
   },
  });
 }

 async edit(settings: TicketSetting, id: string, input: TierInput): Promise<TicketTier> {
  const tiers = await this.list();
  const target = tiers.find((tier) => tier.id.toString() === id);
  if (!target) throw new Error(TierErrors.notFound);

  const names = tiers.map((tier) => (tier.id.toString() === id ? input.name : tier.name));
  await this.assertForumBudget(settings, names);

  return this.client.db.client.ticketTier.update({
   where: { id },
   data: {
    name: input.name,
    claimRoles: input.claimRoles,
    category: input.category ?? null,
    channel: input.channel ?? null,
    reminderSeconds: input.reminderSeconds ?? 0,
   },
  });
 }

 async remove(id: string): Promise<TicketTier[]> {
  const tiers = await this.list();
  if (!tiers.some((tier) => tier.id.toString() === id)) return tiers;

  await this.client.db.client.ticketTier.delete({ where: { id } });
  await this.compact();

  return this.list();
 }

 async move(id: string, direction: MoveDirection): Promise<TicketTier[]> {
  const tiers = await this.list();
  const index = tiers.findIndex((tier) => tier.id.toString() === id);
  const targetIndex = direction === MoveDirection.Up ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= tiers.length) return tiers;

  await this.swapRanks(tiers[index], tiers[targetIndex]);

  return this.list();
 }

 private async swapRanks(a: TicketTier, b: TicketTier): Promise<void> {
  await this.client.db.client.ticketTier.update({
   where: { id: a.id.toString() },
   data: { rank: -1 },
  });
  await this.client.db.client.ticketTier.update({
   where: { id: b.id.toString() },
   data: { rank: a.rank },
  });
  await this.client.db.client.ticketTier.update({
   where: { id: a.id.toString() },
   data: { rank: b.rank },
  });
 }

 private async compact(): Promise<void> {
  const tiers = await this.list();
  const stale = tiers.filter((tier, index) => tier.rank !== index);
  if (!stale.length) return;

  for (let offset = 0; offset < stale.length; offset += 1) {
   await this.client.db.client.ticketTier.update({
    where: { id: stale[offset].id.toString() },
    data: { rank: -(offset + 1) },
   });
  }

  for (let index = 0; index < tiers.length; index += 1) {
   if (tiers[index].rank === index) continue;

   await this.client.db.client.ticketTier.update({
    where: { id: tiers[index].id.toString() },
    data: { rank: index },
   });
  }
 }
}
