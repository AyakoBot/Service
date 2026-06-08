import { type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import constants from '../../../../Classes/Constants.js';
import type TicketPlugin from '../../Plugin.js';
import { buildEndPayload } from '../../Util/buildIntakePayload.js';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (cmd.guild_id) return;

 const ticket = await this.client.db.client.ticket.findUnique({
  where: { id: args[0] },
  include: { settings: true },
 });

 if (!ticket) {
  const t = await this.t(undefined);
  (await buildEndPayload.call(this, t.intake.existingGone())).update(cmd);
  return;
 }

 const t = await this.t(ticket.settings.guild);

 const url =
  ticket.dm && ticket.starterDm
   ? constants.formatters.msgURL(ticket.settings.guild, ticket.dm, ticket.starterDm)
   : null;

 new MessagePayload(this.client, { origin: this.name, reason: 'Ticket intake existing link' })
  .setContent(url ? `${t.intake.existingHere()} ${url}` : t.intake.existingHere())
  .setComponents([])
  .setEmbeds([])
  .update(cmd);
}
