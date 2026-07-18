import type { FilteredWord as FilteredWordRow, FilterType } from '@ayako/database';

import type Client from '../../Classes/Client.js';
import type { CreateData, UpdateData, WhereUnique } from '../../Types/prisma.js';

export default class FilteredWord {
 private client: Client;
 private where: WhereUnique<'filteredWord'>;

 constructor(client: Client, keyword: string, filterType: FilterType) {
  this.client = client;
  this.where = { keyword_filterType: { keyword, filterType } };
 }

 upsert(
  create: CreateData<'filteredWord'>,
  update: UpdateData<'filteredWord'>,
 ): Promise<FilteredWordRow> {
  return this.client.db.client.filteredWord.upsert({ where: this.where, create, update });
 }
}
