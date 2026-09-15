import type { EconomyRoleReward } from '@ayako/database';
import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { filterWritableRoles } from '../../../../Util/roleHierarchy.js';
import { sellableRow } from '../../../../Util/roleRewards.js';
import { RoleWritePriority } from '../../../../Util/roleWriteQueue.js';
import { CustomRoleCommand, CustomRoleSubcommand } from '../../../customRoles/Classes/Commands.js';
import { SpendResult } from '../../Classes/Enums.js';
import type EconomyPlugin from '../../Plugin.js';
import type { EconomyTranslator } from '../../Plugin.js';
import { commandMentions } from '../../../../Util/commandMention.js';
import { shopLabel } from '../../Util/shopLabel.js';
import { deferShop, shopText } from '../../Util/shopReply.js';

const toggleEquip = async function (
 this: EconomyPlugin,
 cmd: APIMessageComponentInteraction,
 row: EconomyRoleReward,
 roleIds: string[],
 note: (text: string) => void,
 t: EconomyTranslator,
): Promise<void> {
 if (!row.purchaseRoles.length) {
  note(t.shop.alreadyOwned());

  return;
 }

 const userId = cmd.member?.user.id ?? cmd.user?.id ?? '';
 const equipped = row.purchaseRoles.some((roleId) => roleIds.includes(roleId));
 const api = await this.getAPI(row.guild);

 const { ok } = await filterWritableRoles.call(this.client, {
  guildId: row.guild,
  botId: api.botId,
  roleIds: row.purchaseRoles,
 });

 if (ok.length < row.purchaseRoles.length) {
  note(t.shop.rolesBlocked());

  return;
 }

 const refused = this.client.roleWrites.enqueue({
  guildId: row.guild,
  userId,
  add: equipped ? [] : row.purchaseRoles,
  remove: equipped ? row.purchaseRoles : [],
  reason: this.name,
  priority: RoleWritePriority.Interactive,
 });

 if (refused) {
  note(t.shop.rolesBlocked());

  return;
 }

 const label = await shopLabel.call(this, row, t.shop.title());

 note(equipped ? t.shop.unequipped({ label }) : t.shop.equipped({ label }));
};

const receipt = async function (
 this: EconomyPlugin,
 cmd: APIMessageComponentInteraction,
 row: EconomyRoleReward,
 t: EconomyTranslator,
): Promise<void> {
 const userId = cmd.member?.user.id ?? cmd.user?.id ?? '';
 const settings = await this.bank.settings(row.guild);
 const symbol = this.symbolOf(settings);
 const balance = await this.bank.balanceOf(row.guild, userId);
 const r = t.shop.receipt;

 const granted = row.purchaseRoles.length
  ? row.purchaseRoles.map((roleId) => `<@&${roleId}>`).join(' ')
  : row.customRoleReward
    ? r.customRole()
    : r.nothing();

 const lines = [
  `## ${r.title()}`,
  `**${r.roles()}** ${granted}`,
  `**${r.paid()}** ${row.buyPrice} ${symbol}`.trimEnd(),
  `**${r.balance()}** ${balance} ${symbol}`.trimEnd(),
 ];

 if (row.customRoleReward) {
  const api = await this.getAPI(row.guild);
  const mention = await commandMentions.call(api);

  lines.push(
   `-# ${r.customRoleHint({
    command: mention(`${CustomRoleCommand.CustomRole} ${CustomRoleSubcommand.Create}`),
   })}`,
  );
 }
 if (row.currency > 0) {
  lines.push(`-# ${r.bonus({ amount: String(row.currency), symbol })}`);
 }
 if (row.payEvery > 0 && row.recurringAmount > 0) {
  lines.push(
   `-# ${r.recurring({
    amount: String(row.recurringAmount),
    symbol,
    days: String(row.payEvery),
   })}`,
  );
 }

 await shopText.call(this, cmd, lines.join('\n'));
};

export default async function (
 this: EconomyPlugin,
 cmd: APIMessageComponentInteraction,
 rowId: string,
): Promise<void> {
 const guildId = cmd.guild_id;
 const userId = cmd.member?.user.id ?? cmd.user?.id;
 if (!guildId || !userId || !rowId) return;

 await deferShop.call(this, cmd);

 const t = await this.t(guildId);
 const note = (text: string) => {
  void shopText.call(this, cmd, text);
 };

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

 if ((await this.shop.owned(guildId, userId, [row.id])).length) {
  await toggleEquip.call(this, cmd, row, roleIds, note, t);

  return;
 }
 if (!sellableRow(row, roleIds, userId)) {
  note(t.shop.notQualified());
  return;
 }

 if (row.customRoleReward) {
  const linked = await this.client.db.client.roleReward.findFirst({
   where: { id: row.customRoleReward, guild: guildId },
  });

  if (!linked?.active || !linked.customRole) {
   note(t.shop.customRoleOff());

   return;
  }

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

 await receipt.call(this, cmd, row, t);
}
