import DBEntry from '../../Classes/abstracts/DBEntry.js';
import type Client from '../../Classes/Client.js';

export default class AFKState extends DBEntry<'afkState'> {
 constructor(client: Client, userId: string, guildId: string) {
  super(client, 'afkState', { userId_guildId: { userId, guildId } });
 }
}
