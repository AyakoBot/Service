import { ComponentType, type APIMessageComponentInteraction } from 'discord-api-types/v10';

import { MessagePayload } from '../../../../Classes/abstracts/MessagePayload.js';
import showCommandError from '../../../../Util/showCommandError.js';

import type TicketPlugin from '../../Plugin.js';
import Ticket from '../../Ticket.js';

import { handleLog, LogType } from './util.js';
import { TicketState } from '@ayako/database';

export default async function (
 this: TicketPlugin,
 cmd: APIMessageComponentInteraction,
 args: string[],
) {
 if (!cmd.channel) return;
 if (!cmd.guild_id) return;

 const ticketId = args.shift() as string;

 const channel =
  (await this.client.cache.channels.get(cmd.channel.id)) ||
  (await this.client.cache.threads.get(cmd.channel.id));
 if (!channel) return;

 const user = cmd.user || cmd.member?.user;
 if (!user) return;

 const t = await this.t(cmd.guild_id);

 if (channel.name.startsWith(`${t.closed()}-`)) {
  showCommandError.call(this.client, t.alreadyClosed(), cmd, t.base);
  return;
 }

 if (!ticketId) {
  showCommandError.call(this.client, t.notFound(), cmd, t.base);
  return;
 }

 const ticket = await new Ticket(this.client, ticketId).getWithInclude({ settings: true });
 if (!ticket || !ticket.settings || !ticket.settings.active) {
  showCommandError.call(this.client, t.notFound(), cmd, t.base);
  return;
 }

 if (ticket.user === user.id) {
  showCommandError.call(this.client, t.cantClaim(), cmd, t.base);
  return;
 }

 const api = await this.client.getAPI(cmd.guild_id);

 api.channels.edit(
  channel.id,
  { name: `${t.claimed()}-${cmd.channel.name}`.slice(0, 30) },
  { origin: this.name, reason: 'Ticket claimed' },
 );

 new MessagePayload(this.client, {
  origin: this.name,
  reason: 'Updating claim message',
 })
  .setContent(`${t.claimedBy()}: <@${user.id}>`)
  .setComponents(
   cmd.message.components?.map((row) => {
    if (row.type !== ComponentType.ActionRow) return row;

    return {
     type: ComponentType.ActionRow as const,
     components: row.components.map((btn) => ({
      ...btn,
      disabled:
       'custom_id' in btn && btn.custom_id?.startsWith('tickets/claim_') ? true : btn.disabled,
     })),
    };
   }) ?? [],
  )
  .update(cmd);

 new Ticket(this.client, ticketId).update({ state: TicketState.claimed }).then();

 handleLog.call(this, String(ticketId), {
  type: LogType.TicketClaimed,
  data: { user },
 });
}
