import DBEntry from '../../classes/abstracts/DBEntry.js';
import type Database from '../../classes/Database.js';

export default class GuildSetting extends DBEntry<'customClient'> {
 constructor(db: Database, guildId: string) {
  super(db, 'customClient', { guildId });
 }
}
