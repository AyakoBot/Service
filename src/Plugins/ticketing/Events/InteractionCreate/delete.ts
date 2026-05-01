import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import showCommandError from '../../../../Util/showCommandError.js';

import type TicketPlugin from '../../Plugin.js';
import Ticket from '../../Ticket.js';
import { handleLog, LogType } from './util.js';
import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.channel) return;
 if (!cmd.guild_id) return;
 if (!cmd.member) return;

 const ticketId = args.shift();
 if (!ticketId) return;

 const user = cmd.user || cmd.member?.user;
 if (!user) return;

 const ticket = await new Ticket(this.client, ticketId).getWithInclude({ settings: true });
 if (!ticket || !ticket.settings || !ticket.settings.active) return;

 const t = await this.t(cmd.guild_id);

 if (
  !cmd.member.roles.some((role) => ticket.settings.mentionRoles.includes(role)) &&
  !ticket.settings.mentionUsers.includes(user.id)
 ) {
  showCommandError.call(this.client, t.onlyStaffCanDelete(), cmd, t.base);
  return;
 }

 new MessagePayload(this.client, { origin: this.name, reason: '"Prepping delete" message' })
  .setEmbeds([])
  .setComponents([])
  .setContent(t.deleting())
  .update(cmd);

 await handleLog.call(this, ticketId, {
  type: LogType.TicketDeleted,
  data: { user },
 });

 const res = (await this.client.getAPI(cmd.guild_id)).channels.delete(cmd.channel.id, {
  origin: this.name,
  reason: 'Ticket deleted',
 });
 if (res && 'message' in res) {
  showCommandError.call(this.client, t.cantDelete(), cmd, t.base);
  return;
 }
}
