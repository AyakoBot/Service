import DBEntry from '../../classes/abstracts/DBEntry.js';
import type Database from '../../classes/Database.js';

export default class GuildSetting extends DBEntry<'guildSetting'> {
 constructor(db: Database, guildId: string) {
  super(db, 'guildSetting', { guildId });
 }
}
