import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import ephemeralNote, { editOriginal } from '../../Util/respond.js';
import { renderPayoutGraph } from '../../../../Util/payoutGraph.js';
import type EconomyPlugin from '../../Plugin.js';

export default async function (
 this: EconomyPlugin,
 cmd: APIMessageComponentInteraction,
 rowId: string,
): Promise<void> {
 const guildId = cmd.guild_id;
 if (!guildId || !rowId) return;

 const t = await this.t(guildId);

 const row = await this.client.db.client.economyRoleReward.findFirst({
  where: { id: rowId, guild: guildId },
 });

 if (!row) {
  ephemeralNote.call(this, cmd, t.shop.missing());

  return;
 }

 if (row.payEvery <= 0 || row.recurringAmount <= 0) {
  ephemeralNote.call(this, cmd, t.settings.rewards.previewNeedsRecurring());

  return;
 }

 const buffer = await renderPayoutGraph(
  row.recurringAmount,
  row.curveModifier,
  row.curve,
  t.settings.rewards.previewTitle({
   base: String(row.recurringAmount),
   curve: t.settings.rewards.curves[row.curve](),
   modifier: String(row.curveModifier),
  }),
 );

 await editOriginal.call(this, cmd, {
  files: [{ name: 'payout-curve.png', data: buffer, contentType: 'image/png' }],
 });
}
