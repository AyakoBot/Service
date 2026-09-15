import { ShopSurface } from '@ayako/database';
import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { sellableRow } from '../../../../Util/roleRewards.js';
import { EconomyRoute } from '../../Classes/Routes.js';
import { shopLabel } from '../../Util/shopLabel.js';
import type EconomyPlugin from '../../Plugin.js';

const rowLimit = 25;
const perRow = 5;

const chunk = (buttons: ButtonBuilder[]): ButtonBuilder[][] =>
 buttons.reduce<ButtonBuilder[][]>((rows, button, index) => {
  if (index % perRow === 0) rows.push([]);
  rows[rows.length - 1]!.push(button);

  return rows;
 }, []);

export default async function (
 this: EconomyPlugin,
 cmd: APIChatInputApplicationCommandInteraction,
): Promise<void> {
 const guildId = cmd.guild_id!;
 const userId = cmd.member?.user.id ?? cmd.user?.id ?? '';

 const t = await this.t(guildId);
 const settings = await this.bank.settings(guildId);

 if (!settings.active) {
  ephemeralNote.call(this, cmd, t.errors.inactive());
  return;
 }

 const rows = await this.client.db.client.economyRoleReward.findMany({
  where: { guild: guildId, active: true, buyPrice: { gt: 0 } },
  orderBy: { buyPrice: 'desc' },
  take: rowLimit,
 });

 if (!rows.length) {
  ephemeralNote.call(this, cmd, t.shop.empty());
  return;
 }

 const roleIds = cmd.member?.roles ?? [];
 const owned = await this.shop.owned(
  guildId,
  userId,
  rows.map((row) => row.id),
 );

 const symbol = this.symbolOf(settings);

 const entries = await Promise.all(
  rows.map(async (row) => {
   const label = await shopLabel.call(this, row, t.shop.title());
   const has = owned.includes(row.id);

   const panelUrl =
    row.shopType === ShopSurface.panel && row.panelChannel && row.panelMessage
     ? constants.formatters.msgURL(guildId, row.panelChannel, row.panelMessage)
     : null;

   return {
    row,
    label,
    has,
    panelUrl,
    equipped: row.purchaseRoles.some((roleId) => roleIds.includes(roleId)),
    buyable: !has && sellableRow(row, roleIds, userId),
   };
  }),
 );

 const lines = entries.map(({ row, label, has, panelUrl }) => {
  const price = has ? t.shop.owned() : t.shop.priced({ price: String(row.buyPrice), symbol });
  const unreachable = row.shopType === ShopSurface.panel && !panelUrl;

  return `- **${label}** — ${price}${unreachable ? ` *(${t.shop.noPanel()})*` : ''}`;
 });

 const buttonLabel = ({
  has,
  equipped,
  label,
 }: {
  has: boolean;
  equipped: boolean;
  label: string;
 }): string => {
  if (!has) return `${t.shop.buy()} ${label}`;

  return equipped ? t.shop.unequip() : t.shop.equip();
 };

 const clickable = entries.filter(
  (entry) => entry.row.shopType === ShopSurface.command || entry.panelUrl,
 );

 const buttons = clickable.map((entry) =>
  entry.panelUrl
   ? new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(entry.panelUrl)
      .setLabel(`${t.shop.openPanel()} ${entry.label}`.slice(0, 80))
   : new ButtonBuilder()
      .setStyle(entry.has ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setCustomId(this.getRoute(EconomyRoute.ShopBuy, entry.row.id))
      .setLabel(buttonLabel(entry).slice(0, 80))
      .setDisabled(!entry.has && !entry.buyable),
 );

 new MessagePayload(this.client, { origin: this.name, reason: 'Economy shop' })
  .setContent(`## ${t.shop.title()}\n${lines.join('\n')}`)
  .setComponents(
   chunk(buttons).map(
    (group) =>
     new ActionRowBuilder<ButtonBuilder>()
      .addComponents(group)
      .toJSON() as APIMessageTopLevelComponent,
   ),
  )
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
}
