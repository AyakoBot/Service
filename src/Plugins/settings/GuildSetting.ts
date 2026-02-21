import DBEntry from '../../Classes/abstracts/DBEntry.js';
import type Client from '../../Classes/Client.js';

export default class GuildSetting extends DBEntry<'guildSetting'> {
 constructor(client: Client, guildId: string) {
  super(client, 'guildSetting', { guildId });
 }
}
