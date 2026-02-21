import type { FilterType } from '@ayako/database';

import DBEntry from '../../Classes/abstracts/DBEntry.js';
import type Client from '../../Classes/Client.js';

export default class FilteredWord extends DBEntry<'filteredWord'> {
 constructor(client: Client, keyword: string, filterType: FilterType) {
  super(client, 'filteredWord', { keyword_filterType: { keyword, filterType } });
 }
}
