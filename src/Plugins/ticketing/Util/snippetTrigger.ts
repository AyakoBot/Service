import type { GatewayDispatchEvents } from 'discord-api-types/v10';

import type { ExtractPayload } from '../../../Types/gateway.js';
import Snippet from '../Classes/Snippet.js';
import type TicketPlugin from '../Plugin.js';

import isSettingsStaff from './isSettingsStaff.js';
import { resolveTicketByChannel, resolveTicketByStaffThread } from './resolveTicket.js';
import { postSnippet } from './runSnippet.js';

type MessageCreateData = ExtractPayload<GatewayDispatchEvents.MessageCreate>;

export const snippetTrigger = async function (
 this: TicketPlugin,
 msg: MessageCreateData,
): Promise<boolean> {
 if (!msg.guild_id) return false;

 const content = (msg.content || '').trim();
 if (!content) return false;

 const snippet = await Snippet.byTrigger(this.client, msg.guild_id, content);
 if (!snippet) return false;

 const ticket =
  (await resolveTicketByChannel.call(this.client, msg.channel_id)) ||
  (await resolveTicketByStaffThread.call(this.client, msg.channel_id));

 if (!ticket) return false;

 const dbTicket = await ticket.getTicket();
 if (!isSettingsStaff(dbTicket.settings, msg.author.id, msg.member?.roles ?? [])) return false;

 const failure = await postSnippet.call(
  this,
  snippet,
  msg.channel_id,
  msg.author.id,
  msg.guild_id,
 );

 if (failure) {
  this.nonFatalError(new Error(failure), 'snippetTrigger');
  return true;
 }

 const api = await this.getAPI(msg.guild_id);
 await api.channels.deleteMessage(msg.channel_id, msg.id, {
  origin: this.name,
  reason: 'Removing snippet trigger message',
 });

 return true;
};
