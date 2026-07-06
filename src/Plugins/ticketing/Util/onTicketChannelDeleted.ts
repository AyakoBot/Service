import { TicketState } from '@ayako/database';

import { LogType } from '../Classes/BaseTicketLogger.js';
import type TicketPlugin from '../Plugin.js';

import { resolveTicketByChannel } from './resolveTicket.js';

export default async function (this: TicketPlugin, channelId: string) {
 const ticket = await resolveTicketByChannel.call(this.client, channelId);
 if (!ticket) return;

 const dbTicket = await ticket.getTicket().catch(() => null);
 if (!dbTicket || dbTicket.state === TicketState.deleted) return;

 await ticket.handleBaseLog({ type: LogType.TicketDeletedUnusual, data: { userId: '' } });
 await ticket.markDeleted();
}
