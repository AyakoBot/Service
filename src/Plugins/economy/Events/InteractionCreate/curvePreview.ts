import { MessageFlags, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import ephemeralNote from '../../../../Util/ephemeralNote.js';
import { renderPayoutGraph } from '../../../../Util/payoutGraph.js';
import type EconomyPlugin from '../../Plugin.js';

export default async function (
 this: EconomyPlugin,
 cmd: APIMessageComponentInteraction,
 rowId: string,
): Promise<void> {
 const guildId = cmd.guild_id;
 if (!guildId || !rowId) return;

 const row = await this.client.db.client.economyRoleReward.findFirst({
  where: { id: rowId, guild: guildId },
 });
 if (!row) return;

 const t = await this.t(guildId);

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

 new MessagePayload(this.client, { origin: this.name, reason: 'Payout curve preview' })
  .setFiles([{ name: 'payout-curve.png', data: buffer, contentType: 'image/png' }])
  .setFlags(MessageFlags.Ephemeral)
  .reply(cmd);
}
