import { TicketType } from '@ayako/database';
import type Client from '../../../Classes/Client.js';
import DmToChannelTicket from '../Classes/DmToChannelTicket.js';
import DmToThreadTicket from '../Classes/DmToThreadTicket.js';
import ChannelTicket from '../Classes/ChannelTicket.js';
import ThreadTicket from '../Classes/ThreadTicket.js';
import { BaseTicketErrors } from '../Classes/Enums.js';
import TicketPlugin from '../Plugin.js';

export default function (this: Client, type: TicketType, ticketId: string) {
 const plugin = this.plugins.find((p) => p instanceof TicketPlugin) as TicketPlugin;

 switch (type) {
  case TicketType.dmToChannel:
   return new DmToChannelTicket(this, ticketId, plugin);

  case TicketType.dmToThread:
   return new DmToThreadTicket(this, ticketId, plugin);

  case TicketType.Channel:
   return new ChannelTicket(this, ticketId, plugin);

  case TicketType.Thread:
   return new ThreadTicket(this, ticketId, plugin);

  default:
   throw new Error(BaseTicketErrors.unknownTicketType, { cause: type });
 }
}
