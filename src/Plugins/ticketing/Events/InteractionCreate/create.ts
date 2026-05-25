import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import type TicketPlugin from '../../Plugin.js';
import handleTicketError from '../../Util/handleTicketError.js';
import BaseTicket from '../../Classes/BaseTicket.js';
import { BaseTicketErrors } from '../../Classes/Enums.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.guild || !cmd.guild_id) return;

 const ticket = await BaseTicket.getTicketById(this.client, args[0]).catch((e: Error) => e);
 const user = cmd.user || cmd.member?.user;

 if (!user) {
  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(BaseTicketErrors.userNotFound, { cause: user }),
   cmd,
  });
  return;
 }

 const member = cmd.member;
 if (!member) {
  const t = await this.t(cmd.guild_id || cmd.guild?.id);

  handleTicketError.call(this.client, {
   guildId: (cmd.guild?.id || cmd.guild_id)!,
   error: new Error(t.base.errors.memberNotFound(), { cause: user }),
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

 const create = ticket.create(
  { channelId: cmd.channel.id, settingsId: args[0], userId: user.id },
  { cmd, userId: user.id, roleIds: member.roles, username: user.username },
 );
 create.next();
}
