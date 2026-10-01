import type { SettingsOption } from '../../settings/SettingsSchema.js';
import type EconomyPlugin from '../Plugin.js';

import { shopLabel } from './shopLabel.js';

export const shopChoices = async function (
 this: EconomyPlugin,
 guildId: string,
): Promise<SettingsOption[]> {
 const t = await this.t(guildId);
 const symbol = this.symbolOf(await this.bank.settings(guildId));
 const rows = await this.client.db.client.economyRoleReward.findMany({
  where: { guild: guildId, buyPrice: { gt: 0 } },
 });

 return Promise.all(
  rows.map(async (row) => ({
   label: await shopLabel.call(this, row, t.shop.title()),
   value: row.id,
   description: `${row.buyPrice} ${symbol}`.trim(),
  })),
 );
};
