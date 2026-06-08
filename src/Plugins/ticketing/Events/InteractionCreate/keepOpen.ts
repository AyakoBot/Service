import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import { BaseTicketErrors } from '../../Classes/Enums.js';
import type TicketPlugin from '../../Plugin.js';
import getTicketClassById from '../../Util/getTicketClassById.js';
import handleTicketError from '../../Util/handleTicketError.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild || !cmd.guild_id) return;

 const userId = cmd.user?.id || cmd.member?.user.id;
 if (!userId) {
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(BaseTicketErrors.userNotFound, { cause: userId }),
   cmd,
  });
  return;
 }

 const ticket = await getTicketClassById.call(this.client, args[0]).catch((e: Error) => e);
 if (ticket instanceof Error || ticket === null) {
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: ticket || new Error(BaseTicketErrors.ticketNotFound, { cause: args[0] }),
   cmd,
  });
  return;
 }

 const row = await ticket.getTicket().catch((e: Error) => e);
 if (row instanceof Error) {
  handleTicketError.call(this.client, { guildId: cmd.guild_id, error: row, cmd });
  return;
 }

 const isStaff = await ticket.isUserStaff(userId).catch(() => false);
 if (!isStaff && row.user !== userId) {
  handleTicketError.call(this.client, {
   guildId: cmd.guild_id,
   error: new Error(BaseTicketErrors.claim_UserNotStaff),
   cmd,
  });
  return;
 }

 await this.reminders.disarmInactivity(args[0]);

 const t = await this.t(cmd.guild_id);
 await new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Acknowledging keep-open request',
 })
  .setContent(`${t.keptOpen()}`)
  .setComponents([])
  .update(cmd);
}
