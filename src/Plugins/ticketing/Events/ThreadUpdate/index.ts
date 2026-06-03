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

 const current = await this.client.cache.threads.get(thread.id);
 const history = await this.client.cache.threads.getAllTimes(thread.id);
 const cachedNames = [current?.name, ...history.map((h) => h?.name)].filter(
  (n): n is string => !!n,
 );

 const canonical = cachedNames.find(
  (n) => n !== newName && (n.startsWith('log-') || n.startsWith('staff-')),
 );
 if (!canonical) return;

 const ticketId = canonical.slice(canonical.indexOf('-') + 1);
 if (!ticketId) return;

 const dbTicket = await this.client.db.client.ticket.findUnique({
  where: { id: ticketId },
  include: { settings: true },
 });
 if (!dbTicket || dbTicket.state === TicketState.deleted) return;

 const api = await this.client.getAPI(dbTicket.settings.guild);

 await api.channels.edit(
  thread.id,
  { name: canonical },
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
