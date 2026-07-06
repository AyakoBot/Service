import { TicketState } from '@ayako/database';

import type Client from '../../../Classes/Client.js';

export interface TicketCounts {
 total: number;
 open: number;
 closed: number;
}

const openStates = [TicketState.opened, TicketState.claimed];

export const ticketCounts = async function (
 this: Client,
 guildId: string,
 userId: string,
): Promise<TicketCounts> {
 const rows = await this.db.client.ticket.findMany({
  where: { user: userId, settings: { guild: guildId } },
  select: { state: true },
 });

 const relevant = rows.filter((r) => r.state !== TicketState.prepared);
 const open = relevant.filter((r) => openStates.includes(r.state)).length;
 const closed = relevant.filter((r) => r.state === TicketState.closed).length;

 return { total: relevant.length, open, closed };
};

export const countOpenForUser = async function (
 this: Client,
 guildId: string,
 userId: string,
): Promise<number> {
 return this.db.client.ticket.count({
  where: { user: userId, settings: { guild: guildId }, state: { in: openStates } },
 });
};

export const matchingOpenTicket = async function (
 this: Client,
 userId: string,
 settingsId: string,
): Promise<string | null> {
 const row = await this.db.client.ticket.findFirst({
  where: { user: userId, settingsId, state: { in: openStates } },
  select: { id: true },
 });

 return row ? String(row.id) : null;
};
