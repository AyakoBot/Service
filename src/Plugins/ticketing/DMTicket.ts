import DBEntry from '../../Classes/abstracts/DBEntry.js';
import type Client from '../../Classes/Client.js';

export default class DMTicket extends DBEntry<'dmTicket'> {
 constructor(client: Client, dmId: string) {
  super(client, 'dmTicket');
 }
}
