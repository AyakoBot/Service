import type Client from '../../../Classes/Client.js';

export interface SettingsDelegate {
 findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
 findMany(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>[]>;
 create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
 updateMany(args: {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
 }): Promise<unknown>;
 deleteMany(args: { where: Record<string, unknown> }): Promise<unknown>;
}

export const tableClient = (client: Client, table: string): SettingsDelegate =>
 (client.db.client as unknown as Record<string, SettingsDelegate>)[table];
