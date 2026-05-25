import type Client from '../../../Classes/Client.js';
import getTicketClassBySettingsType from './getTicketClassBySettingsType.js';

export default async function (this: Client, ticketId: string) {
 const entry = await this.db.client.ticket.findUnique({
  where: { id: ticketId },
  include: { settings: true },
 });
 if (!entry) return null;

 return getTicketClassBySettingsType.call(this, entry.settings.type, ticketId);
}
