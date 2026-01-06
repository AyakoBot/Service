import type { FilterType } from '@ayako/database';

import DBEntry from '../../Classes/abstracts/DBEntry.js';
import type Database from '../../Classes/Database.js';

export default class FilteredWord extends DBEntry<'filteredWord'> {
 constructor(db: Database, keyword: string, filterType: FilterType) {
  super(db, 'filteredWord', { keyword_filterType: { keyword, filterType } });
 }
}
