import { TicketState, type Ticket, type TicketSetting } from '@ayako/database';

import type TicketPlugin from '../Plugin.js';

import { safeBotId } from './resolveDmBotApi.js';

export type StuckDmTicket = Ticket & { settings: TicketSetting };

export default async function (
 this: TicketPlugin,
 userId: string,
 dmChannelId: string,
 receivingBotId: string,
): Promise<StuckDmTicket[]> {
 const rows = await this.client.db.client.ticket.findMany({
  where: {
   user: userId,
   dm: { not: null },
   state: { in: [TicketState.opened, TicketState.claimed] },
  },
  include: { settings: true },
 });

 return rows.filter((row) => {
  if (row.dm === dmChannelId) return false;

  const owner = row.settings.botToken ? safeBotId(row.settings.botToken) : receivingBotId;
  return owner === receivingBotId;
 });
}
