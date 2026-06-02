import { TicketState } from '@ayako/database';
import { type GatewayDispatchEvents } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import type { ExtractPayload } from '../../../../Types/gateway.js';
import type TicketPlugin from '../../Plugin.js';

export default async function (
 this: TicketPlugin,
 thread: ExtractPayload<GatewayDispatchEvents.ThreadUpdate>,
) {
 const newName = thread.name;
 if (!newName) return;

 const times = await this.client.cache.threads.getTimes(thread.id);
 if (times.length < 2) return;

 const sorted = [...times].sort((a, b) => a - b);
 const oldThread = await this.client.cache.threads.getAt(sorted[sorted.length - 2], thread.id);
 const oldName = oldThread?.name;
 if (!oldName || oldName === newName) return;
 if (!oldName.startsWith('log-') && !oldName.startsWith('staff-')) return;

 const ticketId = oldName.slice(oldName.indexOf('-') + 1);
 if (!ticketId) return;

 const dbTicket = await this.client.db.client.ticket.findUnique({
  where: { id: ticketId },
  include: { settings: true },
 });
 if (!dbTicket || dbTicket.state === TicketState.deleted) return;

 const api = await this.client.getAPI(dbTicket.settings.guild);

 await api.channels.edit(
  thread.id,
  { name: oldName },
  { origin: 'TicketLogNameGuard', reason: 'Reverting log thread rename' },
 );

 const t = await this.t(dbTicket.settings.guild);
 await new MessagePayload(this.client, {
  origin: 'TicketLogNameGuard',
  reason: 'Notifying log thread rename revert',
 })
  .setContent(t.logs.nameGuard())
  .setSendTo([{ channel: thread.id, guildId: dbTicket.settings.guild }])
  .send();
}
