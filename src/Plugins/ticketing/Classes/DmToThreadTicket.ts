import type Client from '../../../Classes/Client.js';
import type TicketPlugin from '../Plugin.js';

import { DMTicketMixin } from './DMTicket.js';
import ThreadTicket from './ThreadTicket.js';

export default class DmToThreadTicket extends DMTicketMixin(ThreadTicket) {
 constructor(client: Client, ticketId: string, plugin: TicketPlugin) {
  super(client, ticketId, plugin);
 }
}
