import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { BaseTicketErrors } from '../../Classes/Enums.js';
import type TicketPlugin from '../../Plugin.js';
import getTicketClassById from '../../Util/getTicketClassById.js';
import handleTicketError from '../../Util/handleTicketError.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 const userId = cmd.user?.id || cmd.member?.user.id;

 const ticket = await getTicketClassById.call(this.client, args[0]).catch((e: Error) => e);
 if (ticket instanceof Error || ticket === null) {
  if (cmd.guild_id) {
   handleTicketError.call(this.client, {
    guildId: cmd.guild_id,
    error: ticket || new Error(BaseTicketErrors.ticketNotFound, { cause: args[0] }),
    cmd,
   });
  }
  return;
 }

 const row = await ticket.getTicket().catch((e: Error) => e);
 if (row instanceof Error) {
  if (cmd.guild_id) handleTicketError.call(this.client, { guildId: cmd.guild_id, error: row, cmd });
  return;
 }

 const isStaff = userId ? await ticket.isUserStaff(userId).catch(() => false) : false;
 if (!userId || (!isStaff && row.user !== userId)) {
  handleTicketError.call(this.client, {
   guildId: row.settings.guild,
   error: new Error(BaseTicketErrors.claim_UserNotStaff),
   cmd,
  });
  return;
 }

 await this.reminders.disarmInactivity(args[0]);

 const api = await this.getAPI(row.settings.guild, row.settings.botToken);
 await api.interactions.deferMessageUpdate(cmd.id, cmd.token, {}, {
  origin: this.name,
  reason: 'Acknowledging keep-open request',
 });

 const reason = 'Removing inactivity warning after keep-open';
 if (cmd.guild_id) {
  await api.channels.deleteMessage(cmd.message.channel_id, cmd.message.id, {
   origin: this.name,
   reason,
  });
 } else {
  await api.channels.deleteDirectMessage(cmd.message.channel_id, cmd.message.id, {
   origin: this.name,
   reason,
  });
 }
}
