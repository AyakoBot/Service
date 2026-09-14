import type { APIMessageComponentInteraction } from 'discord-api-types/v10';

import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { sellableRow } from '../../../../Util/roleRewards.js';
import { SpendResult } from '../../Classes/Enums.js';
import type EconomyPlugin from '../../Plugin.js';
import { shopLabel } from '../../Util/shopLabel.js';

export default async function (
 this: EconomyPlugin,
 cmd: APIMessageComponentInteraction,
 rowId: string,
): Promise<void> {
 const guildId = cmd.guild_id;
 const userId = cmd.member?.user.id ?? cmd.user?.id;
 if (!guildId || !userId || !rowId) return;

 const t = await this.t(guildId);
 const note = (text: string) => ephemeralNote.call(this, cmd, text);

 const row = await this.client.db.client.economyRoleReward.findFirst({
  where: { id: rowId, guild: guildId },
 });

 if (!row) {
  note(t.shop.missing());
  return;
 }
 if (!row.active) {
  note(t.shop.inactive());
  return;
 }
 if (row.buyPrice <= 0) {
  note(t.shop.noPrice());
  return;
 }
 if (!row.purchaseRoles.length && !row.customRoleReward) {
  note(t.shop.grantsNothing());
  return;
 }

 const roleIds = cmd.member?.roles ?? [];
 if (!sellableRow(row, roleIds, userId)) {
  note(t.shop.notQualified());
  return;
 }

 if (row.customRoleReward) {
  const held = await this.client.db.client.customRole.findUnique({
   where: { guild_user: { guild: guildId, user: userId } },
  });

  if (held) {
   note(t.shop.hasCustomRole());
   return;
  }
 }

 const result = await this.shop.purchase({
  guildId,
  userId,
  itemId: row.id,
  price: row.buyPrice,
  reason: this.name,
  addRoles: row.purchaseRoles,
 });

 const failures: Partial<Record<SpendResult, string>> = {
  [SpendResult.AlreadyOwned]: t.shop.alreadyOwned(),
  [SpendResult.Insufficient]: t.shop.cannotAfford(),
  [SpendResult.Frozen]: t.shop.frozen(),
  [SpendResult.RolesBlocked]: t.shop.rolesBlocked(),
 };

 if (result !== SpendResult.Ok) {
  note(failures[result] ?? t.shop.unavailable());
  return;
 }

 note(t.shop.bought({ label: await shopLabel.call(this, row, t.shop.title()) }));
}
