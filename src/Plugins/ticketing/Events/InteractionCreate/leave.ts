import { type APIMessageComponentInteraction } from 'discord.js';

import type TicketPlugin from '../../Plugin.js';

import DmToChannelTicket from '../../Classes/DmToChannelTicket.js';
import { BaseTicketErrors } from '../../Classes/Enums.js';
import handleTicketError from '../../Util/handleTicketError.js';

export default async function (this: TicketPlugin, cmd: APIMessageComponentInteraction) {
 const ticket = await DmToChannelTicket.findTicketByDMChannelId(this.client, cmd.channel.id).catch(
  (e: Error) => e,
 );
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
   error: ticket || new Error(BaseTicketErrors.ticketNotFound),
   cmd,
  });
  return;
 }

 ticket.leave(cmd).catch((e: Error) =>
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: e,
   cmd,
  }),
 );
}
