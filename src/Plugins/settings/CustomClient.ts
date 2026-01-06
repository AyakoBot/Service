import DBEntry from '../../Classes/abstracts/DBEntry.js';
import type Database from '../../Classes/Database.js';

export default class GuildSetting extends DBEntry<'customClient'> {
 constructor(db: Database, guildId: string) {
  super(db, 'customClient', { guildId });
 }
}
