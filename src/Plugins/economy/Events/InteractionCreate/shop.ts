import { ShopSurface } from '@ayako/database';
import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import {
 ButtonStyle,
 MessageFlags,
 type APIChatInputApplicationCommandInteraction,
 type APIMessageTopLevelComponent,
} from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
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
  where: {
   guild: guildId,
   active: true,
   shopType: ShopSurface.command,
   buyPrice: { gt: 0 },
  },
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

   return { row, label, has, buyable: !has && sellableRow(row, roleIds, userId) };
  }),
 );

 const lines = entries.map(
  ({ row, label, has }) =>
   `- **${label}** — ${
    has ? t.shop.owned() : t.shop.priced({ price: String(row.buyPrice), symbol })
   }`,
 );

 const buttons = entries.map(({ row, label, has, buyable }) =>
  new ButtonBuilder()
   .setStyle(has ? ButtonStyle.Secondary : ButtonStyle.Success)
   .setCustomId(this.getRoute(EconomyRoute.ShopBuy, row.id))
   .setLabel(`${t.shop.buy()} ${label}`.slice(0, 80))
   .setDisabled(!buyable),
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
