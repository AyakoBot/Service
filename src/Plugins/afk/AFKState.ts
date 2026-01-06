import DBEntry from '../../Classes/abstracts/DBEntry.js';
import type Database from '../../Classes/Database.js';

export default class AFKState extends DBEntry<'afkState'> {
 constructor(db: Database, userId: string, guildId: string) {
  super(db, 'afkState', { userId_guildId: { userId, guildId } });
 }
}
