import type { TicketSetting } from '@ayako/database';
import { TicketState } from '@ayako/database';

import type Client from '../../../Classes/Client.js';

export type LimitResult = { ok: true } | { ok: false; ticketId: string };

export default async function (
 this: Client,
 settings: TicketSetting,
 userId: string,
): Promise<LimitResult> {
 const open = await this.db.client.ticket.findMany({
  where: {
   user: userId,
   settingsId: settings.id,
   state: { in: [TicketState.opened, TicketState.claimed] },
  },
 });

 const limit = settings.ticketLimitKind;
 if (limit <= 0) return { ok: true };
 if (open.length < limit) return { ok: true };

 return { ok: false, ticketId: String(open[0].id) };
}
