import { type APIModalSubmitInteraction } from 'discord-api-types/v10';

import { findModalValue } from '../../../../Util/findModalValue.js';
import { BaseTicketErrors } from '../../Classes/Enums.js';
import type TicketPlugin from '../../Plugin.js';
import getTicketClassById from '../../Util/getTicketClassById.js';
import handleTicketError from '../../Util/handleTicketError.js';

export default async function (
 this: TicketPlugin,
 cmd: APIModalSubmitInteraction,
 args: string[],
) {
 if (!cmd.guild || !cmd.guild_id) return;

 const ticket = await getTicketClassById.call(this.client, args[0]).catch((e: Error) => e);
 const userId = cmd.user?.id || cmd.member?.user.id;

 if (!userId) {
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(BaseTicketErrors.userNotFound, { cause: userId }),
   cmd,
  });
  return;
 }

 if (ticket instanceof Error || ticket === null) {
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: ticket || new Error(BaseTicketErrors.ticketNotFound, { cause: args[0] }),
   cmd,
  });
  return;
 }

 const reason = findModalValue(cmd.data.components, 'reason');

 const close = ticket.close({ cmd, userId, reason });
 close.next().catch((e: Error) =>
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: e,
   cmd,
  }),
 );
}
