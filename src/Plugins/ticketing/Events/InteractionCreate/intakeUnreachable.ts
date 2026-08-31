import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type DmToChannelTicket from '../../Classes/DmToChannelTicket.js';
import type TicketPlugin from '../../Plugin.js';
import { buildGreetingPayload } from '../../Util/buildIntakePayload.js';
import findStuckDmTickets from '../../Util/findStuckDmTickets.js';
import getTicketClassBySettingsType from '../../Util/getTicketClassBySettingsType.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const [ticketId] = args;
 const userId = cmd.user?.id || cmd.member?.user.id;
 if (!ticketId || !userId) return;

 const row = await this.client.db.client.ticket.findFirst({
  where: { id: ticketId, user: userId },
  include: { settings: true },
 });
 if (!row) return;

 const t = await this.t(row.settings.guild);
 const ticket = getTicketClassBySettingsType.call(
  this.client,
  row.settings.type,
  String(row.id),
 ) as DmToChannelTicket;

 await ticket
  .autoClose({ reason: t.intake.unreachableReason() })
  .catch((error: Error) => this.nonFatalError(error, 'intakeUnreachable'));

 const remaining = await findStuckDmTickets.call(
  this,
  userId,
  cmd.channel.id,
  cmd.application_id,
 );
 const closed = !remaining.some((stuck) => String(stuck.id) === ticketId);

 const payload = await buildGreetingPayload.call(
  this,
  '',
  [],
  remaining.length ? String(remaining[0].id) : undefined,
  closed ? t.intake.unreachableClosed() : t.intake.unreachableCloseFailed(),
 );

 payload.update(cmd);
}
