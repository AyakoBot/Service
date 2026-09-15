import type Client from '../../../Classes/Client.js';
import { mintId } from '../../../Util/mintId.js';
import {
 botHighestPosition,
 filterWritableRoles,
 highestPositionOf,
} from '../../../Util/roleHierarchy.js';
import { RoleWritePriority } from '../../../Util/roleWriteQueue.js';
import type EconomyPlugin from '../Plugin.js';

import { LedgerReason, SpendResult } from './Enums.js';

export interface PurchaseRequest {
 guildId: string;
 userId: string;
 itemId: string;
 price: number;
 reason: string;
 addRoles?: string[];
}

export default class EconomyShop {
 plugin: EconomyPlugin;
 client: Client;

 constructor(plugin: EconomyPlugin) {
  this.plugin = plugin;
  this.client = plugin.client;
 }

 private release = async (guildId: string, userId: string, itemId: string): Promise<void> => {
  await this.client.db.client.economyPurchase.deleteMany({
   where: { guild: guildId, user: userId, item: itemId },
  });
 };

 owned = async (guildId: string, userId: string, itemIds: string[]): Promise<string[]> => {
  if (!itemIds.length) return [];

  const rows = await this.client.db.client.economyPurchase.findMany({
   where: { guild: guildId, user: userId, item: { in: itemIds } },
  });

  return rows.map((row) => row.item);
 };

 private canGrant = async (req: PurchaseRequest): Promise<boolean> => {
  const api = await this.plugin.getAPI(req.guildId);
  const roleIds = req.addRoles ?? [];

  const { ok } = await filterWritableRoles.call(this.client, {
   guildId: req.guildId,
   botId: api.botId,
   roleIds,
  });
  if (ok.length < roleIds.length) return false;

  const botPosition = await botHighestPosition.call(this.client, req.guildId, api.botId);
  if (botPosition === null) return false;

  const member = await this.client.cache.members.get(req.guildId, req.userId);
  const targetPosition = await highestPositionOf.call(
   this.client,
   req.guildId,
   member?.roles ?? [],
  );

  return botPosition > targetPosition;
 };

 purchase = async (req: PurchaseRequest): Promise<SpendResult> => {
  const settings = await this.plugin.bank.settings(req.guildId);
  if (!settings.active || settings.frozen) return SpendResult.Frozen;

  const price = Math.max(0, Math.floor(req.price));

  if (req.addRoles?.length && !(await this.canGrant(req))) return SpendResult.RolesBlocked;

  try {
   await this.client.db.client.economyPurchase.create({
    data: { id: mintId(), guild: req.guildId, user: req.userId, item: req.itemId, price },
   });
  } catch {
   return SpendResult.AlreadyOwned;
  }

  if (!(await this.plugin.bank.debit(req.guildId, req.userId, price))) {
   await this.release(req.guildId, req.userId, req.itemId);

   return SpendResult.Insufficient;
  }

  if (req.addRoles?.length) {
   const refused = this.client.roleWrites.enqueue({
    guildId: req.guildId,
    userId: req.userId,
    add: req.addRoles,
    reason: req.reason,
    priority: RoleWritePriority.Interactive,
   });

   if (refused) {
    await this.plugin.bank.credit(req.guildId, req.userId, price);
    await this.release(req.guildId, req.userId, req.itemId);
    await this.plugin.economyLog.record({
     guildId: req.guildId,
     userId: req.userId,
     amount: price,
     reason: LedgerReason.Refund,
    });

    return SpendResult.RolesBlocked;
   }
  }

  await this.plugin.economyLog.record({
   guildId: req.guildId,
   userId: req.userId,
   amount: -price,
   reason: LedgerReason.Purchase,
  });

  return SpendResult.Ok;
 };
}
