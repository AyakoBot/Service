import DBEntry from '../../../Classes/abstracts/DBEntry.js';
import type Client from '../../../Classes/Client.js';

import { MoveDirection } from './Enums.js';

export interface RoleMapEntry {
 role: string;
 label: string;
}

export default class TicketRoleMap extends DBEntry<'ticketRoleMap'> {
 guild: string;

 constructor(client: Client, guild: string) {
  super(client, 'ticketRoleMap', { where: { guild } });
  this.guild = guild;
 }

 async list(): Promise<RoleMapEntry[]> {
  const row = await this.get();
  if (!row) return [];

  const length = Math.min(row.roleMapRoles.length, row.roleMapLabels.length);
  const entries: RoleMapEntry[] = [];
  for (let index = 0; index < length; index += 1) {
   const role = row.roleMapRoles[index];
   if (!role) continue;
   entries.push({ role, label: row.roleMapLabels[index] ?? '' });
  }

  return entries;
 }

 async resolve(roleIds: Set<string>): Promise<string | null> {
  const entries = await this.list();
  const match = entries.find((entry) => roleIds.has(entry.role));
  if (!match) return null;
  return match.label.trim() ? match.label : null;
 }

 async add(role: string, label: string): Promise<RoleMapEntry[]> {
  const entries = await this.list();
  const existing = entries.findIndex((entry) => entry.role === role);

  if (existing === -1) entries.push({ role, label });
  else entries[existing] = { role, label };

  return this.persist(entries);
 }

 async editAt(index: number, label: string): Promise<RoleMapEntry[]> {
  const entries = await this.list();
  if (index < 0 || index >= entries.length) return entries;

  entries[index] = { role: entries[index].role, label };
  return this.persist(entries);
 }

 async removeAt(index: number): Promise<RoleMapEntry[]> {
  const entries = await this.list();
  if (index < 0 || index >= entries.length) return entries;

  entries.splice(index, 1);
  return this.persist(entries);
 }

 async move(index: number, direction: MoveDirection): Promise<RoleMapEntry[]> {
  const entries = await this.list();
  const target = direction === MoveDirection.Up ? index - 1 : index + 1;
  if (index < 0 || index >= entries.length || target < 0 || target >= entries.length) {
   return entries;
  }

  [entries[index], entries[target]] = [entries[target], entries[index]];
  return this.persist(entries);
 }

 private async persist(entries: RoleMapEntry[]): Promise<RoleMapEntry[]> {
  const roleMapRoles = entries.map((entry) => entry.role);
  const roleMapLabels = entries.map((entry) => entry.label);

  await this.upsert(
   { guild: this.guild, roleMapRoles, roleMapLabels },
   { roleMapRoles, roleMapLabels },
  );

  return entries;
 }
}
