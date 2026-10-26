import type { GiveawayPrize } from '@ayako/database';

import type Client from '../../../Classes/Client.js';
import { writeAttempts } from '../constants.js';
import type GiveawaysPlugin from '../Plugin.js';
import isUniqueViolation from '../Util/isUniqueViolation.js';
import { planPrizes, type PrizeAssignment } from '../Util/prizes.js';

export interface PrizeReveal {
 value: string | null;
 listed: boolean;
}

export default class GiveawayPrizes {
 plugin: GiveawaysPlugin;
 client: Client;

 constructor(plugin: GiveawaysPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 open = (message: string): Promise<GiveawayPrize[]> =>
  this.client.db.client.giveawayPrize.findMany({
   where: { message, claimed: false },
   orderBy: { position: 'asc' },
  });

 revealedCount = (message: string): Promise<number> =>
  this.client.db.client.giveawayPrize.count({ where: { message, claimed: true } });

 total = (message: string): Promise<number> =>
  this.client.db.client.giveawayPrize.count({ where: { message } });

 replace = async (message: string, values: string[]) => {
  const last = await this.client.db.client.giveawayPrize.findFirst({
   where: { message, claimed: true },
   orderBy: { position: 'desc' },
  });
  const start = (last?.position ?? -1) + 1;

  await this.client.db.client.$transaction([
   this.client.db.client.giveawayPrize.deleteMany({ where: { message, claimed: false } }),
   this.client.db.client.giveawayPrize.createMany({
    data: values.map((value, index) => ({ message, position: start + index, value })),
   }),
  ]);
 };

 sync = async (message: string) => {
  for (let attempt = 0; attempt < writeAttempts; attempt += 1) {
   const [giveaway, slots] = await Promise.all([
    this.client.db.client.giveaway.findUnique({ where: { message } }),
    this.client.db.client.giveawayPrize.findMany({ where: { message } }),
   ]);
   if (!giveaway || !slots.length) return;

   const plan = planPrizes(slots, giveaway.winners);
   if (!plan.release.length && !plan.assign.length) return;

   await this.release(message, plan.release);
   const assigned = await Promise.all(plan.assign.map((entry) => this.assign(message, entry)));
   if (assigned.every(Boolean)) return;
  }
 };

 reveal = async (message: string, userId: string): Promise<PrizeReveal> => {
  await this.client.db.client.giveawayPrize.updateMany({
   where: { message, winner: userId, claimed: false },
   data: { claimed: true },
  });

  const [own, listed] = await Promise.all([
   this.client.db.client.giveawayPrize.findFirst({ where: { message, winner: userId } }),
   this.client.db.client.giveawayPrize.count({ where: { message } }),
  ]);

  return { value: own?.value ?? null, listed: listed > 0 };
 };

 private release = async (message: string, positions: number[]) => {
  if (!positions.length) return;

  await this.client.db.client.giveawayPrize.updateMany({
   where: { message, position: { in: positions }, claimed: false },
   data: { winner: null },
  });
 };

 private assign = (message: string, { position, winner }: PrizeAssignment): Promise<boolean> =>
  this.client.db.client.giveawayPrize
   .updateMany({ where: { message, position, winner: null }, data: { winner } })
   .then((result) => result.count > 0)
   .catch((error: unknown) => {
    if (isUniqueViolation(error)) return false;
    throw error;
   });
}
