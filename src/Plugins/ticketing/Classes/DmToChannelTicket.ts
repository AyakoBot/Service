import type Client from '../../../Classes/Client.js';
import type TicketPlugin from '../Plugin.js';

import ChannelTicket from './ChannelTicket.js';
import { DMTicketMixin } from './DMTicket.js';

export default class DmToChannelTicket extends DMTicketMixin(ChannelTicket) {
 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
 }
}
